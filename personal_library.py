"""Private Movie Night library, with explicit read-only Nuvio snapshot imports.

Only the three named library/history properties files are read. This module has
no network, source-provider, playback, or Nuvio-write operations.
"""

import copy
import hashlib
import json
import math
import os
import re
import secrets
import stat
import threading
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

from player.aries_adapter import SafeError, java_properties, read_file

STORE = Path.home() / "Documents/Personal-Movies/movie-night-runtime/personal-library.json"
NUVIO_DIR = Path.home() / ".var/app/com.nuvio.media.desktop/config/nuvio"
LIBRARY_AS_FAVORITES = False  # Change only after the source list semantics are verified.
MAX_FILE = 16 * 1024 * 1024
MAX_ROWS = 20000
POSTER_HOSTS = frozenset({"image.tmdb.org", "m.media-amazon.com", "ia.media-imdb.com",
                          "images.metahub.space", "poster.metahub.space"})
FAVORITE_LIST_KEYS = frozenset({"favorites", "favourites"})
_lock = threading.RLock()
_catalogue = {}


class LibraryError(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message
        super().__init__(message)


def _text(value, limit):
    if not isinstance(value, str):
        return ""
    return "".join(c for c in value if ord(c) >= 32 or c in "\n\t").strip()[:limit]


def _integer(value, maximum=10**15):
    return value if isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= maximum else None


def _poster(value):
    if not isinstance(value, str) or len(value) > 2048:
        return None
    try:
        p = urlsplit(value)
        if (p.scheme == "https" and p.hostname in POSTER_HOSTS and p.port in (None, 443)
                and not p.username and not p.password and not p.query and not p.fragment
                and not any(ord(c) < 33 or ord(c) == 127 for c in value)):
            return value
    except ValueError:
        pass
    return None


def _record(raw, progress=False):
    """Copy only display metadata and watch progress; never copy unknown fields."""
    if not isinstance(raw, dict):
        return None
    item_id = (raw.get("parentMetaId") if progress else None) or raw.get("id") or raw.get("imdbId") or raw.get("imdb_id")
    if progress and not item_id:
        item_id = raw.get("videoId")
    kind = (raw.get("parentMetaType") if progress else None) or raw.get("type") or raw.get("contentType")
    if kind is None and isinstance(raw.get("imdb_id"), str):
        kind = "movie"
    if (not isinstance(item_id, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9:._-]{0,199}", item_id)
            or kind not in ("movie", "series")):
        return None
    result = {"id": item_id, "type": kind}
    imdb = raw.get("imdbId") or raw.get("imdb_id") or item_id.split(":")[0]
    if isinstance(imdb, str) and re.fullmatch(r"tt[0-9]{5,12}", imdb):
        result["imdbId"] = imdb
    title = _text(raw.get("title") or raw.get("name"), 300)
    if title:
        result.update({"title": title, "name": title})
    for key, limit in (("description", 4000), ("releaseInfo", 100)):
        value = _text(raw.get(key), limit)
        if value:
            result[key] = value
    if "releaseInfo" not in result and _integer(raw.get("year"), 3000) is not None:
        result["releaseInfo"] = str(raw["year"])
    poster = _poster(raw.get("poster"))
    if poster:
        result["poster"] = poster
    if isinstance(raw.get("genres"), list):
        result["genres"] = list(dict.fromkeys(_text(g, 60) for g in raw["genres"] if _text(g, 60)))[:30]
    rating = raw.get("imdbRating")
    if isinstance(rating, (str, int, float)) and not isinstance(rating, bool):
        try:
            number = float(rating)
            if math.isfinite(number) and 0 <= number <= 10:
                result["imdbRating"] = str(rating)[:8]
        except (ValueError, OverflowError):
            pass
    for key in ("lastPositionMs", "durationMs", "lastUpdatedEpochMs"):
        value = _integer(raw.get(key))
        if value is not None:
            result[key] = value
    if "lastUpdatedEpochMs" not in result and _integer(raw.get("markedAtEpochMs")) is not None:
        result["lastUpdatedEpochMs"] = raw["markedAtEpochMs"]
    if isinstance(raw.get("isCompleted"), bool):
        result["isCompleted"] = raw["isCompleted"]
    for key, alias in (("season", "seasonNumber"), ("episode", "episodeNumber")):
        value = _integer(raw.get(key, raw.get(alias)), 100000)
        if value is not None:
            result[key] = value
    return result


def _key(record):
    return record["type"] + "|" + record["id"]


def _watch_id(record):
    item_id = record["id"]
    if record["type"] == "series" and "season" in record and "episode" in record:
        suffix = f":{record['season']}:{record['episode']}"
        if not item_id.endswith(suffix):
            item_id += suffix
    return item_id


def _unique(records, episodes=False):
    found = {}
    for record in records:
        key = record["type"] + "|" + _watch_id(record) if episodes else _key(record)
        if key not in found or record.get("lastUpdatedEpochMs", 0) >= found[key].get("lastUpdatedEpochMs", 0):
            found[key] = record
    return list(found.values())


def _empty():
    return {"version": 1, "imported_at": None,
            "imported": {"library": [], "recent": [], "watched": [], "favorites": [], "collections": []},
            "favorite_overrides": {}, "local_history": {}, "collections": []}


def _read():
    if not STORE.exists() and not STORE.is_symlink():
        return _empty()
    try:
        state = json.loads(read_file(STORE, MAX_FILE, private=True))
        if not isinstance(state, dict) or state.get("version") != 1:
            raise ValueError()
        imported = state["imported"]
        for name in ("library", "recent", "watched"):
            rows = imported[name]
            if not isinstance(rows, list) or len(rows) > MAX_ROWS:
                raise ValueError()
            normalized = [_record(row) for row in rows]
            if any(row is None for row in normalized):
                raise ValueError()
            imported[name] = normalized
        if (not isinstance(imported["favorites"], list) or len(imported["favorites"]) > MAX_ROWS
                or any(not isinstance(k, str) for k in imported["favorites"])
                or not isinstance(state["favorite_overrides"], dict)
                or not isinstance(state["local_history"], dict)):
            raise ValueError()
        for key, override in state["favorite_overrides"].items():
            record = _record(override["record"])
            if not record or key != _key(record) or not isinstance(override["favorite"], bool):
                raise ValueError()
            override["record"] = record
        for key, raw in state["local_history"].items():
            record = _record(raw)
            if not record:
                raise ValueError()
            state["local_history"][key] = record
        for collection_list in (imported["collections"], state["collections"]):
            if not isinstance(collection_list, list) or len(collection_list) > 500:
                raise ValueError()
            for index, collection in enumerate(collection_list):
                if (not isinstance(collection, dict) or not re.fullmatch(r"[A-Za-z0-9_-]{1,100}", collection["id"])
                        or not isinstance(collection["name"], str) or not isinstance(collection.get("description", ""), str)
                        or not isinstance(collection["movies"], list) or len(collection["movies"]) > MAX_ROWS):
                    raise ValueError()
                rows = [_record(row) for row in collection["movies"]]
                if any(row is None for row in rows):
                    raise ValueError()
                collection_list[index] = {"id": collection["id"], "name": _text(collection["name"], 120),
                                          "description": _text(collection.get("description", ""), 2000), "movies": rows}
        if state["imported_at"] is not None and not isinstance(state["imported_at"], str):
            raise ValueError()
        return state
    except (SafeError, OSError, ValueError, KeyError, TypeError, RecursionError):
        raise LibraryError(503, "Your private movie library could not be read safely.") from None


def _write(state):
    raw = json.dumps(state, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    if len(raw) > MAX_FILE:
        raise LibraryError(409, "Your private movie library has reached its storage limit.")
    directory_fd, temporary = None, None
    try:
        STORE.parent.mkdir(parents=True, mode=0o700, exist_ok=True)
        directory_fd = os.open(STORE.parent, os.O_RDONLY | os.O_DIRECTORY | getattr(os, "O_NOFOLLOW", 0))
        info = os.fstat(directory_fd)
        if info.st_uid != os.getuid() or not stat.S_ISDIR(info.st_mode):
            raise ValueError()
        os.fchmod(directory_fd, 0o700)
        temporary = ".personal-library-" + secrets.token_hex(12)
        fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0),
                     0o600, dir_fd=directory_fd)
        with os.fdopen(fd, "wb") as handle:
            handle.write(raw)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, STORE.name, src_dir_fd=directory_fd, dst_dir_fd=directory_fd)
        temporary = None
        os.fsync(directory_fd)
    except (OSError, ValueError):
        raise LibraryError(503, "Your private movie library could not be saved safely.") from None
    finally:
        if directory_fd is not None:
            if temporary:
                try:
                    os.unlink(temporary, dir_fd=directory_fd)
                except OSError:
                    pass
            os.close(directory_fd)


def register_catalogue(records):
    """Register server-trusted public metadata in memory; no files or arbitrary client records."""
    rows = records.values() if isinstance(records, dict) else records
    if not isinstance(rows, (list, tuple)) and not hasattr(rows, "__iter__"):
        raise LibraryError(400, "Invalid movie catalogue.")
    normalized = [_record(row) for row in rows]
    with _lock:
        _catalogue.update({_key(row): row for row in normalized if row is not None})
    return sum(row is not None for row in normalized)


def _registry(state):
    imported = state["imported"]
    rows = imported["watched"] + imported["recent"] + imported["library"]
    rows += list(state["local_history"].values())
    rows += [item["record"] for item in state["favorite_overrides"].values()]
    rows += [movie for collection in state["collections"] for movie in collection["movies"]]
    return {_key(row): row for row in rows} | _catalogue


def _view(state):
    registry = _registry(state)
    favorite_keys = dict.fromkeys(state["imported"]["favorites"])
    for key, item in state["favorite_overrides"].items():
        if item["favorite"]:
            favorite_keys[key] = None
        else:
            favorite_keys.pop(key, None)
    recent = _unique(state["imported"]["recent"] + list(state["local_history"].values()), episodes=True)
    recent.sort(key=lambda row: row.get("lastUpdatedEpochMs", 0), reverse=True)
    watched = state["imported"]["watched"] + [r for r in state["local_history"].values() if r.get("isCompleted")]
    return copy.deepcopy({"favorites": [registry[key] for key in favorite_keys if key in registry],
                          "recent": recent[:500], "watched": list(dict.fromkeys(_watch_id(r) for r in watched)),
                          "imported_at": state["imported_at"],
                          "collections": state["imported"]["collections"] + state["collections"]})


def read_personal_library():
    with _lock:
        return _view(_read())


def _nuvio_rows(filename, property_key, field):
    try:
        properties = java_properties(read_file(NUVIO_DIR / filename, MAX_FILE))
        payload = json.loads(properties[property_key])
        rows = payload[field]
        if not isinstance(rows, list) or len(rows) > MAX_ROWS:
            raise ValueError()
        return rows
    except (SafeError, ValueError, KeyError, TypeError, RecursionError):
        raise LibraryError(503, "The Nuvio library or watch history is missing or invalid. Nothing was imported.") from None


def import_nuvio(library_as_favorites=False):
    """Import the three explicit snapshots atomically, retaining all local overrides."""
    if not isinstance(library_as_favorites, bool):
        raise LibraryError(400, "Invalid library import mapping.")
    library_rows = _nuvio_rows("nuvio_library.properties", "library_1", "items")
    progress_rows = _nuvio_rows("nuvio_watch_progress.properties", "watch_progress_1", "entries")
    watched_rows = _nuvio_rows("nuvio_watched.properties", "watched_1", "items")
    groups, library, favorite_keys = {}, [], []
    skipped = 0
    for raw in library_rows:
        record = _record(raw)
        if not record:
            skipped += 1
            continue
        library.append(record)
        keys = raw.get("listKeys") or []
        if not isinstance(keys, list) or any(not isinstance(key, str) for key in keys):
            raise LibraryError(503, "The Nuvio list mapping is invalid. Nothing was imported.")
        favorite = library_as_favorites
        for key in keys:
            label = _text(key, 120)
            if not label:
                continue
            if label.casefold() in FAVORITE_LIST_KEYS:
                favorite = True
            else:
                groups.setdefault(label, []).append(record)
        if favorite:
            favorite_keys.append(_key(record))
    recent = [_record(row, progress=True) for row in progress_rows]
    watched = [_record(row) for row in watched_rows]
    skipped += sum(row is None for row in recent + watched)
    recent, watched = [row for row in recent if row], [row for row in watched if row]
    library, recent, watched = _unique(library), _unique(recent, episodes=True), _unique(watched, episodes=True)
    if not (library or recent or watched):
        raise LibraryError(409, "Nuvio has no valid library or watch history to import. Nothing was changed.")
    collections = []
    if library:
        collections.append({"id": "nuvio-library", "name": "Nuvio library",
                            "description": "Read-only snapshot of your saved Nuvio titles.", "movies": library})
    for label, records in groups.items():
        cid = "nuvio-list-" + hashlib.sha256(label.encode("utf-8")).hexdigest()[:16]
        collections.append({"id": cid, "name": label, "description": "Imported Nuvio list.", "movies": _unique(records)})
    if len(collections) > 500:
        raise LibraryError(409, "The Nuvio snapshot contains too many lists. Nothing was imported.")
    imported = {"library": library, "recent": recent, "watched": watched,
                "favorites": list(dict.fromkeys(favorite_keys)), "collections": collections}
    with _lock:
        state = _read()
        if state["imported"] != imported:
            state["imported"] = imported
            state["imported_at"] = datetime.now(timezone.utc).isoformat()
            _write(state)
        result = _view(state)
    result["import_counts"] = {"library": len(library), "recent": len(recent), "watched": len(watched), "skipped": skipped}
    return result


def set_favorite(item_id, kind, favorite):
    if not isinstance(item_id, str) or kind not in ("movie", "series") or not isinstance(favorite, bool):
        raise LibraryError(400, "Choose a known movie or series and a favourite state.")
    with _lock:
        state = _read()
        key = kind + "|" + item_id
        record = _registry(state).get(key)
        if record is None:
            raise LibraryError(404, "This title is not in your catalogue or imported library.")
        value = {"favorite": favorite, "record": record}
        if state["favorite_overrides"].get(key) != value:
            state["favorite_overrides"][key] = value
            _write(state)
        return _view(state)


def record_progress(item_id, kind, position_ms, duration_ms, is_completed=False, season=None, episode=None):
    """Optional server hook for observed playback progress; never starts or controls a player."""
    if (_integer(position_ms) is None or _integer(duration_ms) is None or not isinstance(is_completed, bool)
            or not isinstance(item_id, str) or kind not in ("movie", "series")):
        raise LibraryError(400, "Invalid watch progress.")
    with _lock:
        state = _read()
        record = copy.deepcopy(_registry(state).get(kind + "|" + item_id))
        if record is None:
            raise LibraryError(404, "This title is not in your catalogue or imported library.")
        record.update({"lastPositionMs": position_ms, "durationMs": duration_ms, "isCompleted": is_completed,
                       "lastUpdatedEpochMs": int(datetime.now(timezone.utc).timestamp() * 1000)})
        for key, value in (("season", season), ("episode", episode)):
            if value is not None:
                if _integer(value, 100000) is None:
                    raise LibraryError(400, "Invalid episode information.")
                record[key] = value
        state["local_history"][kind + "|" + _watch_id(record)] = record
        if len(state["local_history"]) > 500:
            oldest = min(state["local_history"], key=lambda key: state["local_history"][key].get("lastUpdatedEpochMs", 0))
            del state["local_history"][oldest]
        _write(state)
        return record


def save_collection(name, description, imdb_ids, canonical):
    if (not isinstance(name, str) or not 1 <= len(name.strip()) <= 120
            or not isinstance(description, str) or len(description) > 2000
            or not isinstance(imdb_ids, list) or not 1 <= len(imdb_ids) <= 500
            or any(not isinstance(i, str) or not re.fullmatch(r"tt[0-9]{5,12}", i) for i in imdb_ids)):
        raise LibraryError(400, "Invalid saved collection.")
    rows = canonical.values() if isinstance(canonical, dict) else canonical
    try:
        normalized = [_record(row) for row in rows]
        allowed = {r["imdbId"]: r for r in normalized if r and r.get("imdbId")}
        ids = list(dict.fromkeys(imdb_ids))
        movies = [allowed[item_id] for item_id in ids]
    except (KeyError, TypeError):
        raise LibraryError(400, "Every saved title must come from the current movie catalogue.") from None
    name, description = _text(name, 120), _text(description, 2000)
    if not name:
        raise LibraryError(400, "Give your collection a name.")
    digest = hashlib.sha256((name + "\n" + "\n".join(ids)).encode("utf-8")).hexdigest()[:16]
    collection = {"id": "personal-" + digest, "name": name, "description": description, "movies": movies}
    with _lock:
        state = _read()
        existing = next((c for c in state["collections"] if c["id"] == collection["id"]), None)
        if existing != collection:
            state["collections"] = [c for c in state["collections"] if c["id"] != collection["id"]] + [collection]
            if len(state["collections"]) > 500:
                raise LibraryError(409, "Your saved collection limit has been reached.")
            _write(state)
        return copy.deepcopy(collection)


def read_saved_collections():
    """Only explicit private custom lists, suitable for the private wall API."""
    with _lock:
        return copy.deepcopy(_read()["collections"])


def handle(handler):
    route = urlsplit(handler.path).path
    routes = {"/api/personal-library", "/api/personal-library/import", "/api/personal-library/favorite"}
    if route not in routes:
        return False
    try:
        hosts = {f"127.0.0.1:{handler.server.server_port}", f"localhost:{handler.server.server_port}"}
        origin = handler.headers.get("Origin")
        if handler.headers.get("Host") not in hosts:
            raise LibraryError(400, "Use the local Movie Night address.")
        if (origin and origin not in {"http://" + host for host in hosts}) or handler.headers.get("Sec-Fetch-Site") == "cross-site":
            raise LibraryError(403, "Use your Movie Night library.")
        if route == "/api/personal-library" and handler.command in ("GET", "HEAD"):
            handler.json_response(200, read_personal_library())
            return True
        if route != "/api/personal-library" and handler.command == "POST":
            if handler.headers.get("X-Movie-Night") != "1":
                raise LibraryError(403, "Use your Movie Night library.")
            try:
                length = int(handler.headers.get("Content-Length", "0"))
                if (not 0 < length <= 8192 or handler.headers.get("Transfer-Encoding")
                        or handler.headers.get("Content-Type", "").split(";")[0].strip() != "application/json"):
                    raise ValueError()
                handler.connection.settimeout(10)
                raw = handler.rfile.read(length)
                if len(raw) != length:
                    raise ValueError()
                payload = json.loads(raw)
                if not isinstance(payload, dict):
                    raise ValueError()
            except (ValueError, OSError, RecursionError):
                raise LibraryError(400, "Invalid personal library request.") from None
            if route.endswith("/import"):
                if payload:
                    raise LibraryError(400, "Import does not accept configuration or source paths.")
                result = import_nuvio(library_as_favorites=LIBRARY_AS_FAVORITES)
            else:
                if set(payload) != {"id", "type", "favorite"}:
                    raise LibraryError(400, "Choose a known title and a favourite state.")
                result = set_favorite(payload["id"], payload["type"], payload["favorite"])
            handler.json_response(200, result)
            return True
        raise LibraryError(405, "Unsupported personal library request.")
    except LibraryError as exc:
        handler.json_response(exc.status, {"error": exc.message})
        return True

"""Read-only Cinemeta catalogue bridge; no accounts, streams, or player actions.

Server integration: call ``handle(handler, register_catalogue=callback)`` from
GET dispatch. It returns True only for its three routes. The optional callback
receives a list of sanitized canonical records, including on cache hits. Route
POST/other methods through it if a JSON 405 response is desired; no write method
is implemented. ``handler.json_response(status, payload)`` is the only required
response method; the usual local Host check is also enforced here.

``catalogues(params)``, ``browse(params)`` and ``meta(params)`` accept dictionaries
of single strings. The catalogue directory is a bounded description of this
gateway's supported feeds, not a claim to enumerate every title in Cinemeta.
Run ``python3 catalogue_browse.py --self-test`` for wholly mocked verification.
Only successful normalized results are cached, in memory, for five minutes.
"""

from collections import OrderedDict
from copy import deepcopy
from datetime import datetime, timezone
import html
import ipaddress
import json
import math
import queue
import re
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, quote, urlsplit, urlunsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

ORIGIN = "https://v3-cinemeta.strem.io"
CATALOGUE_HOST = "cinemeta-catalogs.strem.io"
MAX_REDIRECTS = 2
TIMEOUT = 8.0
CACHE_SECONDS = 300
MAX_RESPONSE = 4 * 1024 * 1024
CATALOGUE_PAGE_SIZE = 50
LEGACY_SEARCH_PAGE_SIZE = 100
MAX_PAGE_RECORDS = 100
MAX_SKIP = 1_000_000
MAX_CACHE_ENTRIES = 32
GENRES = (
    "Action", "Adventure", "Animation", "Biography", "Comedy", "Crime",
    "Documentary", "Drama", "Family", "Fantasy", "Film-Noir", "History",
    "Horror", "Music", "Musical", "Mystery", "Romance", "Sci-Fi", "Sport",
    "Thriller", "War", "Western",
)
CATALOGS = {"top": "Popular", "imdbRating": "Featured", "year": "New"}
# Source: the official https://v3-cinemeta.strem.io/manifest.json, retrieved
# 2026-10-22, version 3.0.14. Keep the transport's catalogue allowlist fixed.
# The manifest also advertises personalized last-videos/calendar-videos routes;
# those are not general browsing lists and are outside this metadata gateway.
MANIFEST_VERSION = "3.0.14"
MANIFEST_VERIFIED_ON = "2026-10-22"
MOVIE_GENRES = (
    "Action", "Adventure", "Animation", "Biography", "Comedy", "Crime",
    "Documentary", "Drama", "Family", "Fantasy", "History", "Horror",
    "Mystery", "Romance", "Sci-Fi", "Sport", "Thriller", "War", "Western",
)
SERIES_ONLY_GENRES = ("Reality-TV", "Talk-Show", "Game-Show")
GENRES_BY_TYPE = {"movie": MOVIE_GENRES, "series": MOVIE_GENRES + SERIES_ONLY_GENRES}
FIRST_CATALOGUE_YEAR = {"movie": 1920, "series": 1960}
IMDB_ID = re.compile(r"tt[0-9]{5,12}\Z")
_CONTROLS = re.compile(r"[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]")
_cache = OrderedDict()
_cache_lock = threading.Lock()
_fetch_slots = threading.BoundedSemaphore(4)


class CatalogueError(Exception):
    """Only these fixed, safe messages are returned through the HTTP adapter."""

    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _catalogue_redirect(location, original_path):
    """Accept only the official catalogue host and the unchanged catalogue path.

    Cinemeta routes /catalog/<type>/<catalog>/... to
    /<catalog>/catalog/<type>/<catalog>/... on its catalogue host. Metadata
    requests cannot redirect. Comparing the full expected path also preserves
    the validated search, genre, and offset rather than accepting new extras.
    """
    match = re.fullmatch(r"/catalog/(movie|series)/(top|imdbRating|year)(?:/[^?#]+)?\.json", original_path)
    if (match is None or not isinstance(location, str) or len(location) > 4096
            or re.search(r"[\s\\\x00-\x1f?#]", location)):
        return False
    try:
        target = urlsplit(location)
        return (target.scheme == "https" and target.hostname == CATALOGUE_HOST
                and target.port in (None, 443) and target.username is None
                and target.password is None and not target.query and not target.fragment
                and target.path == "/" + match[2] + original_path)
    except ValueError:
        return False


def _open_response(opener, path, deadline):
    """Follow at most two allowlisted redirects without reading redirect bodies."""
    target = ORIGIN + path
    for hop in range(MAX_REDIRECTS + 1):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError()
        # Rebuild safe headers for each host; never forward cookies or auth.
        request = Request(target, headers={
            "Accept": "application/json", "Accept-Encoding": "identity",
            "User-Agent": "MovieNight-Catalogue/1.0",
        }, method="GET")
        try:
            return opener.open(request, timeout=min(TIMEOUT, remaining))
        except HTTPError as exc:
            if exc.code not in (301, 302, 303, 307, 308):
                raise
            location = exc.headers.get("Location")
            exc.close()
            if hop >= MAX_REDIRECTS or not _catalogue_redirect(location, path):
                raise CatalogueError(502, "The catalogue returned an unavailable response.") from None
            target = location


def _read_document(path):
    """Fixed HTTPS entry point with narrowly allowlisted catalogue redirects."""
    deadline = time.monotonic() + TIMEOUT
    try:
        opener = build_opener(ProxyHandler({}), _NoRedirect())
        with _open_response(opener, path, deadline) as response:
            if response.status != 200:
                raise CatalogueError(502, "The catalogue returned an unavailable response.")
            if response.headers.get("Content-Encoding", "identity").lower() != "identity":
                raise ValueError()
            size = response.headers.get("Content-Length")
            if size is not None and (not size.isdecimal() or int(size) > MAX_RESPONSE):
                raise ValueError()
            chunks, total = [], 0
            read = getattr(response, "read1", response.read)
            while True:
                if time.monotonic() >= deadline:
                    raise TimeoutError()
                chunk = read(min(65536, MAX_RESPONSE + 1 - total))
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_RESPONSE:
                    raise ValueError()
                chunks.append(chunk)
        result = json.loads(b"".join(chunks))
        if not isinstance(result, dict) or result.get("error"):
            raise ValueError()
        return result
    except HTTPError as exc:
        status = exc.code
        exc.close()
        if status == 404 and path.startswith("/meta/"):
            raise CatalogueError(404, "This title is unavailable in the catalogue.") from None
        raise CatalogueError(502, "The catalogue is unavailable just now.") from None
    except TimeoutError:
        raise CatalogueError(504, "The catalogue took too long to respond.") from None
    except URLError as exc:
        if isinstance(exc.reason, TimeoutError):
            raise CatalogueError(504, "The catalogue took too long to respond.") from None
        raise CatalogueError(502, "The catalogue is unavailable just now.") from None
    except (OSError, ValueError, TypeError, RecursionError):
        raise CatalogueError(502, "The catalogue returned an unavailable response.") from None


def _fetch_document(path):
    """Bound caller wait to eight seconds, including DNS; cap in-flight workers.

    Socket timeouts alone do not bound DNS or a slowly delivered response.
    Daemon workers let the caller time out without an unbounded executor queue;
    a timed-out worker retains its slot until its network operation finishes.
    """
    if not _fetch_slots.acquire(blocking=False):
        raise CatalogueError(503, "The catalogue is busy. Please try again shortly.")
    result = queue.Queue(maxsize=1)

    def fetch():
        try:
            result.put((True, _read_document(path)))
        except CatalogueError as exc:
            result.put((False, exc))
        except Exception:
            result.put((False, CatalogueError(502, "The catalogue is unavailable just now.")))
        finally:
            _fetch_slots.release()

    try:
        threading.Thread(target=fetch, name="movie-night-catalogue", daemon=True).start()
    except RuntimeError:
        _fetch_slots.release()
        raise CatalogueError(503, "The catalogue is busy. Please try again shortly.") from None
    try:
        ok, value = result.get(timeout=TIMEOUT)
    except queue.Empty:
        raise CatalogueError(504, "The catalogue took too long to respond.") from None
    if not ok:
        raise value
    return value


def _text(value, limit):
    if not isinstance(value, str):
        return ""
    value = html.unescape(value[:limit * 4])
    return " ".join(_CONTROLS.sub(" ", value).split())[:limit].strip()


def _poster(value):
    """Keep only ordinary public HTTPS image addresses; never fetch them here."""
    if not isinstance(value, str) or len(value) > 2048 or re.search(r"[\s\\\x00-\x1f]", value):
        return ""
    try:
        parsed = urlsplit(value)
        host = parsed.hostname or ""
        if (parsed.scheme != "https" or parsed.username is not None
                or parsed.password is not None or parsed.port not in (None, 443)
                or len(host) > 253
                or not re.fullmatch(r"(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}", host)
                or host.endswith((".local", ".localhost", ".internal"))):
            return ""
        try:
            ipaddress.ip_address(host)
            return ""  # Catalogue artwork never needs a literal IP address.
        except ValueError:
            pass
        return urlunsplit(("https", parsed.netloc, parsed.path, parsed.query, ""))
    except ValueError:
        return ""


def normalize_record(raw, media_type, rank=None):
    """Whitelist public display metadata; discard every other upstream field."""
    if not isinstance(raw, dict) or raw.get("type", media_type) != media_type:
        return None
    imdb_id = raw.get("imdb_id") or raw.get("id")
    title = _text(raw.get("name") or raw.get("title"), 300)
    if not isinstance(imdb_id, str) or not IMDB_ID.fullmatch(imdb_id) or not title:
        return None
    year_value = raw.get("year") or raw.get("releaseInfo") or raw.get("released")
    match = (re.match(r"^(\d{4})(?:\D|$)", str(year_value))
             if isinstance(year_value, (str, int)) and not isinstance(year_value, bool) else None)
    year = int(match[1]) if match else None
    if year is not None and not 1900 <= year <= datetime.now(timezone.utc).year:
        year = None
    genres = []
    if isinstance(raw.get("genres"), list):
        for entry in raw["genres"][:32]:
            genre = _text(entry, 40)
            if genre and genre not in genres:
                genres.append(genre)
    runtime = raw.get("runtime")
    if isinstance(runtime, (int, float)) and not isinstance(runtime, bool):
        runtime = f"{int(runtime)} min" if 0 < runtime <= 1440 else ""
    rating = raw.get("imdbRating")
    try:
        rating = float(rating) if not isinstance(rating, bool) else None
    except (ValueError, TypeError, OverflowError):
        rating = None
    if rating is not None and (not math.isfinite(rating) or not 0 <= rating <= 10):
        rating = None
    result = {
        "imdb_id": imdb_id, "type": media_type, "title": title, "year": year,
        "poster": _poster(raw.get("poster")), "genres": genres,
        "runtime": _text(runtime, 64), "description": _text(raw.get("description"), 4000),
        "imdbRating": rating,
    }
    if rank is not None:
        result["rank"] = rank
    return result


def _validate_params(params, allowed):
    if (not isinstance(params, dict) or set(params) - set(allowed)
            or any(not isinstance(value, str) for value in params.values())):
        raise CatalogueError(400, "Unsupported catalogue parameters.")
    media_type = params.get("type", "movie")
    if media_type not in ("movie", "series"):
        raise CatalogueError(400, "Choose movies or series.")
    return media_type


def _cached(path, make_result):
    now = time.monotonic()
    with _cache_lock:
        cached = _cache.get(path)
        if cached and cached[0] > now:
            _cache.move_to_end(path)
            return deepcopy(cached[1])
        _cache.pop(path, None)
    result = make_result(_fetch_document(path))
    # Missing episode metadata is not an empty authoritative hierarchy. Do not
    # cache it as success and suppress recovery on the next ordinary card open.
    movie = result.get("movie") if isinstance(result, dict) else None
    if isinstance(movie, dict) and movie.get("type") == "series" and "episodes" not in movie:
        return result
    with _cache_lock:
        _cache[path] = (time.monotonic() + CACHE_SECONDS, deepcopy(result))
        _cache.move_to_end(path)
        while len(_cache) > MAX_CACHE_ENTRIES:
            _cache.popitem(last=False)
    return result


def catalogues(params=None):
    """Describe every general-purpose feed supported by this fixed gateway.

    This local directory does not fetch six feeds on startup. Its provider
    contract is explicitly dated; actual records and continuation cursors come
    from /api/browse. A null total is intentional: neither manifest nor feed
    responses establish the size of the whole catalogue.
    """
    params = {} if params is None else params
    selected_type = _validate_params(params, ("type",))
    types = (selected_type,) if "type" in params else ("movie", "series")
    current_year = datetime.now(timezone.utc).year
    years = {kind: list(range(current_year, FIRST_CATALOGUE_YEAR[kind] - 1, -1)) for kind in types}
    descriptions = {
        "top": "Explore the provider's popular titles, with more pages as you browse.",
        "imdbRating": "Explore the provider's featured selection, with optional genre filtering.",
        "year": "Browse titles by release year, including earlier years in the year selector.",
    }
    entries = []
    for kind in types:
        label = "movies" if kind == "movie" else "TV series"
        for catalog, name in CATALOGS.items():
            request = {"type": kind, "catalog": catalog}
            if catalog == "year":
                request["genre"] = str(current_year)
            entries.append({
                "key": f"cinemeta-{kind}-{catalog}", "type": kind,
                "catalog": catalog, "name": f"{name} {label}",
                "catalog_name": name, "description": descriptions[catalog],
                "params": request,
                "genre_options": list(GENRES_BY_TYPE[kind]) if catalog != "year" else [],
                "year_options": years[kind] if catalog == "year" else [],
                "supports_search": catalog == "top", "pagination": True,
                "total": None,
            })
    return {
        "schema": "movie-night.catalogues/v1", "source": "Cinemeta",
        "manifest_version": MANIFEST_VERSION, "manifest_verified_on": MANIFEST_VERIFIED_ON,
        "catalogues": entries, "genres": {kind: list(GENRES_BY_TYPE[kind]) for kind in types},
        "years": years,
        "filter_scopes": {
            "catalogue": ["media_type", "catalog", "genre", "release_year", "search"],
            "loaded_results": ["year_range", "multiple_genres", "excluded_genres", "rating", "runtime", "library_state"],
            "notes": "Genre applies to Popular/Featured. Release year applies to New. Search uses Popular. Other filters apply to loaded records.",
        },
        "pagination": {"follow_next_skip": True, "max_skip": MAX_SKIP, "total_known": False},
    }


def browse(params):
    """Return at most 100 records; preserve provider pagination, not row count.

    Catalogue feeds advance by 50 positions and expose a boolean hasMore. A
    position may have no metadata, so a page can contain only 49 records. Direct
    legacy search responses omit hasMore and retain their 100-position stride.
    """
    media_type = _validate_params(params, ("type", "catalog", "genre", "skip", "search"))
    catalog = params.get("catalog", "top")
    if catalog not in CATALOGS:
        raise CatalogueError(400, "Choose Popular, Featured, or New.")
    skip_text = params.get("skip", "0")
    if not re.fullmatch(r"[0-9]{1,7}", skip_text) or int(skip_text) > MAX_SKIP:
        raise CatalogueError(400, "skip must be a nonnegative catalogue offset.")
    skip = int(skip_text)
    genre = params.get("genre", "").strip()
    search = params.get("search", "").strip()
    if len(search) > 160 or _CONTROLS.search(search):
        raise CatalogueError(400, "Search must be plain text of at most 160 characters.")
    if search and catalog != "top":
        raise CatalogueError(400, "Search is available in the Popular catalogue.")
    if catalog == "year":
        if not re.fullmatch(r"[0-9]{4}", genre) or not 1900 <= int(genre) <= datetime.now(timezone.utc).year:
            raise CatalogueError(400, "New requires a year from 1900 through the current year in genre.")
    elif genre and genre not in GENRES and not (media_type == "series" and genre in SERIES_ONLY_GENRES):
        raise CatalogueError(400, "Choose one of the available catalogue genres.")
    extras = []
    if genre:
        extras.append("genre=" + quote(genre, safe=""))
    if search:
        extras.append("search=" + quote(search, safe=""))
    extras.append("skip=" + str(skip))
    path = f"/catalog/{media_type}/{catalog}/" + "&".join(extras) + ".json"

    def make_result(document):
        rows = document.get("metas")
        if not isinstance(rows, list):
            raise CatalogueError(502, "The catalogue returned an unavailable response.")
        provider_more = document.get("hasMore")
        if "hasMore" in document and not isinstance(provider_more, bool):
            raise CatalogueError(502, "The catalogue returned an unavailable response.")
        page_size = (LEGACY_SEARCH_PAGE_SIZE if search and provider_more is None
                     else CATALOGUE_PAGE_SIZE)
        movies, seen = [], set()
        for index, raw in enumerate(rows[:MAX_PAGE_RECORDS]):
            record = normalize_record(raw, media_type, skip + index + 1)
            if record and record["imdb_id"] not in seen:
                seen.add(record["imdb_id"])
                movies.append(record)
        has_more = (provider_more if isinstance(provider_more, bool) else len(rows) >= page_size)
        has_more = has_more and skip + page_size <= MAX_SKIP
        return {"movies": movies, "has_more": has_more,
                "next_skip": skip + page_size if has_more else None,
                "source": "Cinemeta", "type": media_type, "catalog": catalog,
                "catalog_name": CATALOGS[catalog], "genre": genre,
                "search": search, "skip": skip, "page_size": page_size}

    return _cached(path, make_result)


def _episode_people(value):
    """Names only from explicit episode credits. Never inherit series cast."""
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, list):
        return []
    names = []
    for person in value[:40]:
        name = _text(person.get("name") if isinstance(person, dict) else person, 120)
        if name and name not in names:
            names.append(name)
    return names


def episode_records(raw, series_id):
    """Public episode metadata only. Stream URLs and provider hints never pass through."""
    if not isinstance(raw, list):
        return []
    found = {}
    for video in raw[:20000]:
        if not isinstance(video, dict):
            continue
        season, episode = video.get("season"), video.get("episode")
        if type(season) is not int or type(episode) is not int or not 0 <= season <= 10000 or not 1 <= episode <= 100000:
            continue
        identity = f"{series_id}:{season}:{episode}"
        if video.get("id") != identity or identity in found:
            continue
        released = _text(video.get("released"), 40)
        if released:
            try:
                datetime.fromisoformat(released.replace("Z", "+00:00"))
            except ValueError:
                released = ""
        rating = video.get("rating")
        try:
            rating = float(rating) if not isinstance(rating, bool) else None
        except (ValueError, TypeError, OverflowError):
            rating = None
        if rating is not None and (not math.isfinite(rating) or not 0 <= rating <= 10):
            rating = None
        runtime = video.get("runtime")
        if type(runtime) not in (int, float) or not math.isfinite(runtime) or not 0 < runtime <= 1440:
            runtime = None
        found[identity] = {"id": identity, "season": season, "episode": episode,
            "title": _text(video.get("title"), 300) or _text(video.get("name"), 300) or f"Episode {episode}",
            "overview": _text(video.get("overview"), 2000) or _text(video.get("description"), 2000), "released": released,
            "thumbnail": _poster(video.get("thumbnail")), "rating": rating, "runtime_minutes": runtime,
            **{key: _episode_people(video.get(key)) for key in ("cast", "guest_stars", "director", "writer")}}
    return sorted(found.values(), key=lambda row: (row["season"], row["episode"]))


def meta(params):
    """Return {movie, source}; metadata only, including for series records."""
    media_type = _validate_params(params, ("type", "id"))
    imdb_id = params.get("id", "")
    if not IMDB_ID.fullmatch(imdb_id):
        raise CatalogueError(400, "Choose a valid IMDb title.")
    path = f"/meta/{media_type}/{imdb_id}.json"

    def make_result(document):
        record = normalize_record(document.get("meta"), media_type)
        if record is None or record["imdb_id"] != imdb_id:
            raise CatalogueError(404, "This title is unavailable in the catalogue.")
        raw = document["meta"]
        # Enrich detail responses only, using an explicit public-field allowlist.
        # Never forward upstream behavior hints, stream objects or arbitrary links.
        for key in ("background", "logo"):
            record[key] = _poster(raw.get(key))
        for key in ("cast", "director", "writer"):
            values = raw.get(key, [])
            if isinstance(values, str):
                values = [values]
            record[key] = list(dict.fromkeys(_text(value, 120) for value in values[:40]
                                             if isinstance(value, str) and _text(value, 120))) if isinstance(values, list) else []
        for key in ("country", "awards", "language"):
            record[key] = _text(raw.get(key), 800)
        if media_type == "series" and isinstance(raw.get("videos"), list):
            episodes = episode_records(raw["videos"], imdb_id)
            # Explicit [] means no episodes returned. Missing, malformed, or an
            # entirely rejected nonempty list remains incomplete, not empty.
            if episodes or not raw["videos"]:
                record["episodes"] = episodes
        record["metadata_source"] = "Cinemeta"
        return {"movie": record, "source": "Cinemeta", "type": media_type}

    return _cached(path, make_result)


def handle(handler, register_catalogue=None):
    """Handle the three exact GET routes; return False for all other paths."""
    try:
        parsed = urlsplit(handler.path)
    except ValueError:
        return False
    if parsed.path not in ("/api/catalogues", "/api/browse", "/api/browse/meta"):
        return False
    try:
        if handler.command != "GET":
            raise CatalogueError(405, "Catalogue browsing supports GET only.")
        hosts = {f"127.0.0.1:{handler.server.server_port}", f"localhost:{handler.server.server_port}"}
        if handler.headers.get("Host", "") not in hosts:
            raise CatalogueError(400, "Use the local Movie Night address.")
        if parsed.scheme or parsed.netloc or parsed.fragment or len(parsed.query) > 2048:
            raise CatalogueError(400, "Invalid catalogue query.")
        try:
            # An absent query means no parameters. Strict parsing of "" differs
            # between supported Python versions; keep every nonempty query
            # strict, including malformed empty fields such as "&".
            pairs = (parse_qsl(parsed.query, keep_blank_values=True, strict_parsing=True,
                               max_num_fields=5, encoding="utf-8", errors="strict")
                     if parsed.query else [])
        except (ValueError, UnicodeError):
            raise CatalogueError(400, "Invalid catalogue query.") from None
        if len({key for key, value in pairs}) != len(pairs):
            raise CatalogueError(400, "Catalogue parameters must not be repeated.")
        operation = {"/api/catalogues": catalogues, "/api/browse": browse, "/api/browse/meta": meta}[parsed.path]
        result = operation(dict(pairs))
        records = result["movies"] if "movies" in result else [result["movie"]] if "movie" in result else None
        if records is not None and register_catalogue is not None:
            try:
                register_catalogue(deepcopy(records))
            except Exception:
                raise CatalogueError(503, "The catalogue could not be prepared. Please try again.") from None
        handler.json_response(200, result)
    except CatalogueError as exc:
        handler.json_response(exc.status, {"error": exc.message, "source": "Cinemeta"})
    return True


def _self_test():
    """No network, account files, server, or playback is used by these tests."""
    import io
    import unittest
    from types import SimpleNamespace
    from unittest.mock import patch

    sample = {"id": "tt0111161", "type": "movie", "name": "A &amp; B\x00",
              "releaseInfo": "1994", "poster": "https://m.media-amazon.com/a.jpg",
              "genres": ["Drama", "Drama", None], "runtime": "142 min",
              "description": "A public description", "imdbRating": "9.3",
              "streams": [{"url": "https://private.invalid/secret"}], "videos": ["ignored"]}

    class Tests(unittest.TestCase):
        def setUp(self):
            with _cache_lock:
                _cache.clear()

        def test_catalogue_directory_is_bounded_and_local(self):
            with patch(__name__ + "._fetch_document") as fetch:
                result = catalogues()
                self.assertEqual(len(result["catalogues"]), 6)
                self.assertEqual({(item["type"], item["catalog"]) for item in result["catalogues"]},
                                 {(kind, catalog) for kind in ("movie", "series") for catalog in CATALOGS})
                self.assertTrue(all(item["total"] is None and item["pagination"] for item in result["catalogues"]))
                self.assertNotIn("Reality-TV", result["genres"]["movie"])
                self.assertIn("Reality-TV", result["genres"]["series"])
                self.assertEqual(result["years"]["movie"][-1], 1920)
                self.assertEqual(result["years"]["series"][-1], 1960)
                for item in result["catalogues"]:
                    self.assertEqual(item["supports_search"], item["catalog"] == "top")
                    if item["catalog"] == "year":
                        self.assertEqual(item["params"]["genre"], str(datetime.now(timezone.utc).year))
                        self.assertFalse(item["genre_options"])
                    else:
                        self.assertFalse(item["year_options"])
                only_series = catalogues({"type": "series"})
                self.assertEqual(len(only_series["catalogues"]), 3)
                self.assertEqual(set(only_series["genres"]), {"series"})
                result["catalogues"][0]["genre_options"].clear()
                result["genres"]["movie"].clear()
                self.assertTrue(catalogues()["genres"]["movie"])
                for params in ({"type": "anime"}, {"url": "https://bad"}, {"catalog": "top"}, {"type": ["movie"]}):
                    with self.subTest(params=params), self.assertRaises(CatalogueError):
                        catalogues(params)
                fetch.assert_not_called()

        def test_catalogue_directory_route_never_registers_records(self):
            replies, registered = [], []
            handler = SimpleNamespace(path="/api/catalogues", command="GET",
                                      server=SimpleNamespace(server_port=8789),
                                      headers={"Host": "127.0.0.1:8789"},
                                      json_response=lambda status, body: replies.append((status, body)))
            with patch(__name__ + "._fetch_document") as fetch:
                self.assertTrue(handle(handler, lambda records: registered.extend(records)))
                self.assertEqual(replies[-1][0], 200)
                self.assertEqual(len(replies[-1][1]["catalogues"]), 6)
                self.assertFalse(registered)
                for path, method, host, status in (
                        ("/api/catalogues?type=series", "GET", "127.0.0.1:8789", 200),
                        ("/api/catalogues?type=series&type=movie", "GET", "127.0.0.1:8789", 400),
                        ("/api/catalogues?url=https%3A%2F%2Fbad", "GET", "127.0.0.1:8789", 400),
                        ("/api/catalogues", "POST", "127.0.0.1:8789", 405),
                        ("/api/catalogues", "GET", "outside.invalid", 400)):
                    handler.path, handler.command, handler.headers["Host"] = path, method, host
                    handle(handler)
                    self.assertEqual(replies[-1][0], status)
                fetch.assert_not_called()

        def test_empty_query_is_portable_without_relaxing_strict_validation(self):
            replies = []
            handler = SimpleNamespace(path="/api/catalogues", command="GET",
                                      server=SimpleNamespace(server_port=8789),
                                      headers={"Host": "127.0.0.1:8789"},
                                      json_response=lambda status, body: replies.append((status, body)))
            real_parser = parse_qsl

            def older_strict_parser(query, **kwargs):
                if query == "" and kwargs.get("strict_parsing"):
                    raise ValueError("bad query field: ''")
                return real_parser(query, **kwargs)

            with patch(__name__ + ".parse_qsl", side_effect=older_strict_parser) as parser, \
                    patch(__name__ + "._fetch_document", return_value={"metas": [], "hasMore": False}) as fetch:
                for path, status in (
                        ("/api/catalogues", 200), ("/api/catalogues?", 200),
                        ("/api/browse", 200), ("/api/browse?", 200),
                        ("/api/catalogues?type=series", 200),
                        ("/api/catalogues?&", 400),
                        ("/api/catalogues?type", 400),
                        ("/api/catalogues?type=series&", 400),
                        ("/api/catalogues?type=series&type=movie", 400),
                        ("/api/catalogues?type=%FF", 400)):
                    with self.subTest(path=path):
                        handler.path = path
                        self.assertTrue(handle(handler))
                        self.assertEqual(replies[-1][0], status)
                self.assertTrue(all(call.args[0] and call.kwargs["strict_parsing"]
                                    for call in parser.call_args_list))
                fetch.assert_called_once_with("/catalog/movie/top/skip=0.json")

        def test_series_genres_and_long_catalogue_continuation(self):
            series = {**sample, "type": "series"}
            with patch(__name__ + "._fetch_document", return_value={"metas": [series], "hasMore": True}) as fetch:
                result = browse({"type": "series", "catalog": "imdbRating", "genre": "Reality-TV", "skip": "100"})
                fetch.assert_called_once_with("/catalog/series/imdbRating/genre=Reality-TV&skip=100.json")
                self.assertEqual(result["next_skip"], 150)
                self.assertTrue(result["has_more"])
            with patch(__name__ + "._fetch_document") as fetch:
                with self.assertRaises(CatalogueError):
                    browse({"type": "movie", "genre": "Reality-TV"})
                fetch.assert_not_called()
            # Empty/partially sanitized pages must not incorrectly terminate
            # the provider's list or derive a continuation from displayed rows.
            with patch(__name__ + "._fetch_document", return_value={"metas": [], "hasMore": True}):
                result = browse({"skip": "150"})
                self.assertEqual(result["movies"], [])
                self.assertEqual(result["next_skip"], 200)
                last = browse({"skip": str(MAX_SKIP)})
                self.assertFalse(last["has_more"])
                self.assertIsNone(last["next_skip"])

        def test_normalization_and_types(self):
            result = normalize_record(sample, "movie", 1)
            self.assertEqual(result["title"], "A & B")
            self.assertEqual(result["year"], 1994)
            self.assertEqual(result["genres"], ["Drama"])
            self.assertEqual(result["imdbRating"], 9.3)
            self.assertFalse({"streams", "videos", "url"} & set(result))
            self.assertIsNone(normalize_record(sample, "series"))
            self.assertIsNone(normalize_record({**sample, "id": "https://bad"}, "movie"))
            self.assertEqual(_poster("https://user:secret@example.com/x"), "")
            self.assertEqual(_poster("http://127.0.0.1/x"), "")
            self.assertEqual(_poster("https://127.0.0.1/x"), "")
            self.assertEqual(_poster("https://127.1/x"), "")
            self.assertIsNone(normalize_record({**sample, "imdbRating": "NaN"}, "movie")["imdbRating"])
            self.assertEqual(normalize_record({**sample, "runtime": 10 ** 1000}, "movie")["runtime"], "")

        def test_url_pagination_cache_and_copy(self):
            rows = [{**sample, "id": f"tt{1100000 + i}"} for i in range(101)]
            rows[3] = {"id": "invalid"}
            with patch(__name__ + "._fetch_document", return_value={"metas": rows}) as fetch:
                params = {"search": "A & B/é", "genre": "Sci-Fi", "skip": "100"}
                result = browse(params)
                fetch.assert_called_once_with("/catalog/movie/top/genre=Sci-Fi&search=A%20%26%20B%2F%C3%A9&skip=100.json")
                self.assertEqual(len(result["movies"]), 99)
                self.assertTrue(result["has_more"])
                self.assertEqual(result["next_skip"], 200)
                result["movies"].clear()
                self.assertEqual(len(browse(params)["movies"]), 99)
                self.assertEqual(fetch.call_count, 1)
                with _cache_lock:
                    for key, (_, value) in list(_cache.items()):
                        _cache[key] = (0, value)
                browse(params)
                self.assertEqual(fetch.call_count, 2)

        def test_validation_never_fetches(self):
            bad = [{"type": "anime"}, {"catalog": "unknown"}, {"url": "https://bad"},
                   {"skip": "-1"}, {"skip": "1000001"}, {"genre": "unknown"},
                   {"catalog": "imdbRating", "search": "x"}, {"catalog": "year"},
                   {"catalog": "year", "genre": "1899"}, {"search": "x" * 161},
                   {"search": "x\x00y"}, {"skip": ["0"]}]
            with patch(__name__ + "._fetch_document") as fetch:
                for params in bad:
                    with self.subTest(params=params), self.assertRaises(CatalogueError) as caught:
                        browse(params)
                    self.assertEqual(caught.exception.status, 400)
                fetch.assert_not_called()

        def test_provider_pagination_and_legacy_search(self):
            rows = [{**sample, "id": f"tt{1100000 + i}"} for i in range(100)]
            cases = [
                ({}, {"metas": rows[:49], "hasMore": True}, 49, 50, True, 50),
                ({"skip": "50"}, {"metas": rows[:50], "hasMore": True}, 50, 50, True, 100),
                ({"skip": "100"}, {"metas": rows[:50], "hasMore": False}, 50, 50, False, None),
                ({"catalog": "year", "genre": "1995"}, {"metas": rows[:50], "hasMore": True}, 50, 50, True, 50),
                ({"search": "legacy-full"}, {"metas": rows}, 100, 100, True, 100),
                ({"search": "Brazil"}, {"metas": rows[:13]}, 13, 100, False, None),
                ({"search": "provider-search"}, {"metas": rows[:49], "hasMore": True}, 49, 50, True, 50),
            ]
            for params, document, count, stride, more, next_skip in cases:
                with self.subTest(params=params), patch(__name__ + "._fetch_document", return_value=document):
                    result = browse(params)
                    self.assertEqual(len(result["movies"]), count)
                    self.assertEqual(result["page_size"], stride)
                    self.assertEqual(result["has_more"], more)
                    self.assertEqual(result["next_skip"], next_skip)
            with patch(__name__ + "._fetch_document", return_value={"metas": rows, "hasMore": "true"}):
                with self.assertRaises(CatalogueError):
                    browse({"skip": "150"})

        def test_year_series_and_meta(self):
            series = {**sample, "type": "series", "releaseInfo": "1994–1999"}
            with patch(__name__ + "._fetch_document", return_value={"metas": [series]}) as fetch:
                result = browse({"type": "series", "catalog": "year", "genre": "1994"})
                fetch.assert_called_once_with("/catalog/series/year/genre=1994&skip=0.json")
                self.assertEqual(result["movies"][0]["type"], "series")
                self.assertFalse(result["has_more"])
            with patch(__name__ + "._fetch_document", return_value={"meta": series}):
                self.assertEqual(meta({"type": "series", "id": "tt0111161"})["movie"]["year"], 1994)
            with patch(__name__ + "._fetch_document", return_value={"meta": sample}):
                with self.assertRaises(CatalogueError):
                    meta({"id": "tt0111162"})

        def test_fetch_bounds_and_no_redirects(self):
            class Response(io.BytesIO):
                status = 200
                headers = {}
            with patch(__name__ + ".build_opener") as factory:
                factory.return_value.open.return_value = Response(b'{"metas":[]}')
                self.assertEqual(_read_document("/catalog/movie/top/skip=0.json"), {"metas": []})
                request = factory.return_value.open.call_args.args[0]
                self.assertEqual(request.full_url, ORIGIN + "/catalog/movie/top/skip=0.json")
                self.assertTrue(0 < factory.return_value.open.call_args.kwargs["timeout"] <= 8.0)
                self.assertIsInstance(factory.call_args.args[1], _NoRedirect)
                self.assertEqual(factory.call_args.args[0].proxies, {})
                factory.return_value.open.return_value = Response(b"x" * (MAX_RESPONSE + 1))
                with self.assertRaises(CatalogueError) as caught:
                    _read_document("/catalog/movie/top/skip=0.json")
                self.assertEqual(caught.exception.status, 502)
                factory.return_value.open.return_value = Response(b"not JSON")
                with self.assertRaises(CatalogueError):
                    _read_document("/catalog/movie/top/skip=0.json")
            self.assertIsNone(_NoRedirect().redirect_request(None, None, 302, "", {}, "http://127.0.0.1/"))
            with patch(__name__ + ".queue.Queue") as fake_queue, patch(__name__ + ".threading.Thread"):
                fake_queue.return_value.get.side_effect = queue.Empty
                try:
                    with self.assertRaises(CatalogueError) as caught:
                        _fetch_document("/catalog/movie/top/skip=0.json")
                    self.assertEqual(caught.exception.status, 504)
                    fake_queue.return_value.get.assert_called_once_with(timeout=8.0)
                finally:
                    _fetch_slots.release()  # The mocked worker never ran.

        def test_narrow_catalogue_redirects(self):
            class Response(io.BytesIO):
                status = 200
                headers = {}
            path = "/catalog/movie/top/skip=0.json"
            target = "https://cinemeta-catalogs.strem.io/top" + path
            self.assertTrue(_catalogue_redirect(target, path))
            self.assertTrue(_catalogue_redirect(target.replace(".io/", ".io:443/"), path))
            for wrong in (
                    target.replace("https:", "http:"), target.replace(".io/", ".io:8443/"),
                    target.replace("//", "//user:secret@", 1), target + "?x=1", target + "#x",
                    target.replace("strem.io", "strem.io.invalid"),
                    target.replace("skip=0", "skip=100"), target.replace("/movie/", "/series/"),
                    "https://127.0.0.1/top" + path, "/top" + path):
                with self.subTest(target=wrong):
                    self.assertFalse(_catalogue_redirect(wrong, path))
            self.assertFalse(_catalogue_redirect(target, "/meta/movie/tt0111161.json"))
            body = io.BytesIO(b"Redirect body is never read")
            redirect = HTTPError(ORIGIN + path, 307, "Temporary Redirect", {"Location": target}, body)
            with patch(__name__ + ".build_opener") as factory:
                factory.return_value.open.side_effect = [redirect, Response(b'{"metas":[]}')]
                self.assertEqual(_read_document(path), {"metas": []})
                self.assertTrue(body.closed)
                calls = factory.return_value.open.call_args_list
                self.assertEqual(len(calls), 2)
                self.assertEqual(calls[1].args[0].full_url, target)
                self.assertEqual({key.lower() for key, value in calls[1].args[0].header_items()},
                                 {"accept", "accept-encoding", "user-agent"})
            bodies = [io.BytesIO(b"unused") for _ in range(3)]
            with patch(__name__ + ".build_opener") as factory:
                factory.return_value.open.side_effect = [
                    HTTPError(ORIGIN + path, 307, "Redirect", {"Location": target}, fp) for fp in bodies]
                with self.assertRaises(CatalogueError) as caught:
                    _read_document(path)
                self.assertEqual(caught.exception.status, 502)
                self.assertEqual(factory.return_value.open.call_count, 3)
                self.assertTrue(all(fp.closed for fp in bodies))

        def test_handler_and_registration(self):
            replies, registered = [], []
            handler = SimpleNamespace(path="/api/browse?type=movie", command="GET",
                                      server=SimpleNamespace(server_port=8789),
                                      headers={"Host": "127.0.0.1:8789"},
                                      json_response=lambda status, body: replies.append((status, body)))
            with patch(__name__ + "._fetch_document", return_value={"metas": [sample]}) as fetch:
                self.assertTrue(handle(handler, lambda records: registered.extend(records)))
                self.assertEqual(replies[-1][0], 200)
                self.assertEqual(registered[0]["imdb_id"], "tt0111161")
                handler.path = "/api/browse?type=movie&type=series"
                handle(handler)
                self.assertEqual(replies[-1][0], 400)
                handler.path, handler.command = "/api/browse", "POST"
                handle(handler)
                self.assertEqual(replies[-1][0], 405)
                self.assertEqual(fetch.call_count, 1)
                handler.path = "/api/not-browse"
                self.assertFalse(handle(handler))
            handler.path, handler.command = "/api/browse?search=new", "GET"
            with patch(__name__ + "._fetch_document", side_effect=CatalogueError(502, "The catalogue is unavailable just now.")):
                handle(handler)
                self.assertEqual(replies[-1], (502, {"error": "The catalogue is unavailable just now.", "source": "Cinemeta"}))

    outcome = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Tests))
    return 0 if outcome.wasSuccessful() else 1


if __name__ == "__main__":
    import sys
    if sys.argv[1:] != ["--self-test"]:
        raise SystemExit("Usage: python3 catalogue_browse.py --self-test")
    raise SystemExit(_self_test())

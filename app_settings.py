"""Private Movie Night preferences, shared live by the wall and Aries adapter.

This module never reads Nuvio configuration. The only provider status request is
to the authenticated, fixed local adapter endpoint, which returns safe flags.
"""

import copy
import fcntl
import json
import os
import re
import stat
import tempfile
import threading
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

STORE = Path.home() / "Documents/Personal-Movies/movie-night-runtime/app-settings.json"
SCHEMA = "movie-night.settings/v1"
MAX_BYTES = 16384
MAX_REVISION = 9007199254740990
MODEL_TAG = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]*(?:/[A-Za-z0-9][A-Za-z0-9_.-]*)?(?::[A-Za-z0-9][A-Za-z0-9_.-]*)?\Z")
DEFAULTS = {
    "appearance": {"mode": "glass", "opacity": 82},
    "browsing": {"start_view": "curated", "catalog": "top", "card_size": "comfortable", "show_ratings": True},
    "playback": {"preferred_quality": "balanced", "prefer_small_encodes": True, "default_volume": 100, "seek_seconds": 10},
    "plugins": {"torrentio_enabled": True, "cinemeta_enabled": True, "ollama_enabled": True},
    "concierge": {"model": "llama3.1:8b"},
}
_lock = threading.RLock()


class SettingsError(Exception):
    def __init__(self, code, message, status=400):
        self.code, self.message, self.status = code, message, status
        super().__init__(message)


def _invalid():
    return SettingsError("invalid_settings", "Choose valid Movie Night settings.")


def _unavailable():
    return SettingsError("settings_unavailable", "Movie Night settings could not be read or saved.", 503)


def valid_model_tag(value):
    return isinstance(value, str) and 1 <= len(value) <= 160 and MODEL_TAG.fullmatch(value) is not None


def _integer(value, minimum, maximum):
    return type(value) is int and minimum <= value <= maximum


def validate(settings):
    """Require the complete known schema, with no URLs, secrets or free-form hosts."""
    if not isinstance(settings, dict) or set(settings) != set(DEFAULTS):
        raise _invalid()
    for section, values in DEFAULTS.items():
        if not isinstance(settings[section], dict) or set(settings[section]) != set(values):
            raise _invalid()
    a, b, p, plugins, c = (settings[key] for key in DEFAULTS)
    if (a["mode"] not in ("glass", "solid") or not _integer(a["opacity"], 60, 95)
            or b["start_view"] not in ("curated", "browse-movie", "browse-series", "nuvio-library", "personal-favorites", "personal-recent")
            or b["catalog"] not in ("top", "imdbRating", "year")
            or b["card_size"] not in ("compact", "comfortable", "large")
            or type(b["show_ratings"]) is not bool
            or p["preferred_quality"] not in ("balanced", "2160p", "1080p", "720p")
            or type(p["prefer_small_encodes"]) is not bool
            or not _integer(p["default_volume"], 0, 100)
            or type(p["seek_seconds"]) is not int or p["seek_seconds"] not in (5, 10, 30)
            or any(type(value) is not bool for value in plugins.values())
            or not valid_model_tag(c["model"])):
        raise _invalid()
    return copy.deepcopy(settings)


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError()
        result[key] = value
    return result


def _decode(raw):
    return json.loads(raw, object_pairs_hook=_unique_object,
                      parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))


def _check_directory():
    info = STORE.parent.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise _unavailable()


def read_document():
    """Return defaults without creating files; invalid existing data fails closed."""
    try:
        _check_directory()
        fd = os.open(STORE, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
        with os.fdopen(fd, "rb") as handle:
            info = os.fstat(handle.fileno())
            if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid()
                    or info.st_mode & 0o077 or info.st_size > MAX_BYTES):
                raise _unavailable()
            raw = handle.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES:
            raise _unavailable()
        data = _decode(raw)
        if (not isinstance(data, dict) or set(data) != {"schema", "revision", "settings"}
                or data["schema"] != SCHEMA or not _integer(data["revision"], 0, MAX_REVISION)):
            raise _unavailable()
        return {"revision": data["revision"], "settings": validate(data["settings"])}
    except FileNotFoundError:
        return {"revision": 0, "settings": copy.deepcopy(DEFAULTS)}
    except (OSError, ValueError, TypeError, RecursionError, SettingsError):
        raise _unavailable() from None


def read_settings():
    return read_document()["settings"]


def update_document(payload, model_validator=None):
    """Compare-and-swap a complete document under a cross-process private lock."""
    if (not isinstance(payload, dict) or set(payload) != {"revision", "settings"}
            or not _integer(payload["revision"], 0, MAX_REVISION - 1)):
        raise _invalid()
    settings = validate(payload["settings"])
    temporary = None
    try:
        with _lock:
            STORE.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            _check_directory()
            lock_path = STORE.parent / "app-settings.lock"
            lock_fd = os.open(lock_path, os.O_CREAT | os.O_RDWR | getattr(os, "O_NOFOLLOW", 0), 0o600)
            with os.fdopen(lock_fd, "r+b") as lock_file:
                info = os.fstat(lock_file.fileno())
                if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
                    raise _unavailable()
                fcntl.flock(lock_file, fcntl.LOCK_EX)
                current = read_document()
                if current["revision"] != payload["revision"]:
                    raise SettingsError("revision_conflict", "Settings changed in another window. Reload and try again.", 409)
                if settings == current["settings"]:
                    return current
                if settings["concierge"]["model"] != current["settings"]["concierge"]["model"]:
                    if model_validator is None or not model_validator(settings["concierge"]["model"]):
                        raise SettingsError("model_not_installed", "Choose an installed Ollama model.", 422)
                document = {"schema": SCHEMA, "revision": current["revision"] + 1, "settings": settings}
                raw = json.dumps(document, ensure_ascii=False, allow_nan=False, sort_keys=True, indent=2).encode() + b"\n"
                fd, temporary = tempfile.mkstemp(prefix=".app-settings-", dir=STORE.parent)
                with os.fdopen(fd, "wb") as output:
                    os.fchmod(output.fileno(), 0o600)
                    output.write(raw)
                    output.flush()
                    os.fsync(output.fileno())
                os.replace(temporary, STORE)
                temporary = None
                directory_fd = os.open(STORE.parent, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
                try:
                    os.fsync(directory_fd)
                finally:
                    os.close(directory_fd)
                return {"revision": document["revision"], "settings": copy.deepcopy(settings)}
    except SettingsError:
        raise
    except (OSError, ValueError, TypeError, RecursionError):
        raise _unavailable() from None
    finally:
        if temporary is not None:
            try:
                os.unlink(temporary)
            except OSError:
                pass


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _adapter_status(server):
    """Only fixed loopback /plugins; neither response URLs nor errors pass through."""
    token, port = getattr(server, "player_token", None), getattr(server, "player_port", None)
    if not isinstance(token, str) or not token or not _integer(port, 1024, 65535):
        return {"configured": False, "status": "adapter_unavailable"}
    try:
        request = Request(f"http://127.0.0.1:{port}/plugins", headers={"Authorization": "Bearer " + token, "Accept": "application/json"})
        with build_opener(ProxyHandler({}), _NoRedirect()).open(request, timeout=4) as response:
            raw = response.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES:
            raise ValueError()
        result = _decode(raw)
        row = result.get("torrentio") if isinstance(result, dict) else None
        if (not isinstance(row, dict) or type(row.get("configured")) is not bool
                or row.get("status") not in ("configured", "addon_unavailable", "addon_ambiguous", "config_unavailable")):
            raise ValueError()
        return {"configured": row["configured"], "status": row["status"]}
    except Exception:
        return {"configured": False, "status": "adapter_unavailable"}


def plugin_status(server):
    import concierge
    document = read_document()
    settings = document["settings"]
    provider = _adapter_status(server)
    enabled = settings["plugins"]["torrentio_enabled"]
    messages = {
        "configured": "Existing Torrentio configuration is available. Sources are checked when you choose a movie.",
        "addon_unavailable": "No enabled Torrentio configuration was found in the existing installation.",
        "addon_ambiguous": "More than one enabled Torrentio configuration was found.",
        "config_unavailable": "The Aries adapter could not read the existing configuration.",
        "adapter_unavailable": "The Aries playback adapter is unavailable.",
    }
    rows = [{"id": "torrentio", "name": "Torrentio + Real-Debrid", "enabled": enabled,
             "configured": provider["configured"], "available": enabled and provider["configured"],
             "status": provider["status"] if enabled else "disabled", "connection_checked": False,
             "message": messages[provider["status"]] if enabled else "Source search is disabled in Movie Night. Current playback controls remain available."}]
    enabled = settings["plugins"]["cinemeta_enabled"]
    rows.append({"id": "cinemeta", "name": "Cinemeta", "enabled": enabled, "configured": True,
                 "available": enabled, "status": "ready" if enabled else "disabled", "connection_checked": False,
                 "message": "Public movie and TV browsing is enabled. The service is contacted when you browse." if enabled else "Public movie and TV browsing is disabled in Movie Night."})
    enabled, selected = settings["plugins"]["ollama_enabled"], settings["concierge"]["model"]
    try:
        names = concierge.installed_models()
        configured, checked = selected in names, True
        ollama_status = "ready" if configured else "model_missing"
        message = "The selected local concierge model is installed." if configured else "The selected movie concierge model is not installed."
    except concierge.ConciergeError:
        names, configured, checked, ollama_status = [], False, False, "unavailable"
        message = "Ollama could not be reached on this device."
    rows.append({"id": "ollama", "name": "Ollama", "enabled": enabled, "configured": configured,
                 "available": enabled and configured, "status": ollama_status if enabled else "disabled",
                 "connection_checked": checked,
                 "message": message if enabled else "The movie concierge is disabled in Movie Night."})
    return {"revision": document["revision"], "plugins": rows, "models": names, "selected_model": selected}


def _local_hosts(handler):
    hosts = {f"127.0.0.1:{handler.server.server_port}", f"localhost:{handler.server.server_port}"}
    if handler.headers.get("Host") not in hosts:
        raise SettingsError("invalid_origin", "Use the local Movie Night address.", 403)
    return hosts


def gate_catalogue(handler):
    """Gate live public-provider requests; the local list directory stays visible."""
    if urlsplit(handler.path).path not in ("/api/browse", "/api/browse/meta"):
        return False
    try:
        _local_hosts(handler)
        if not read_settings()["plugins"]["cinemeta_enabled"]:
            raise SettingsError("plugin_disabled", "Enable Cinemeta in Settings to browse public movies and TV.", 503)
        return False
    except SettingsError as error:
        handler.json_response(error.status, {"error": error.message, "code": error.code})
        return True


def handle(handler):
    route = urlsplit(handler.path).path
    if route not in ("/api/settings", "/api/settings/plugins"):
        return False
    try:
        hosts = _local_hosts(handler)
        if handler.command in ("GET", "HEAD"):
            handler.json_response(200, read_document() if route == "/api/settings" else plugin_status(handler.server))
            return True
        if handler.command != "POST" or route != "/api/settings":
            raise SettingsError("method_not_allowed", "Unsupported settings request.", 405)
        origin = handler.headers.get("Origin")
        if (handler.headers.get("X-Movie-Night") != "1"
                or (origin and origin not in {"http://" + host for host in hosts})
                or handler.headers.get("Sec-Fetch-Site") == "cross-site"):
            raise SettingsError("invalid_origin", "Use the Movie Night settings panel.", 403)
        try:
            length = int(handler.headers.get("Content-Length", "0"))
            if (not 0 < length <= MAX_BYTES or handler.headers.get("Transfer-Encoding")
                    or handler.headers.get("Content-Type", "").split(";")[0].strip() != "application/json"):
                raise ValueError()
            handler.connection.settimeout(10)
            raw = handler.rfile.read(length)
            if len(raw) != length:
                raise ValueError()
            payload = _decode(raw)
        except (ValueError, OSError, TypeError, RecursionError):
            raise _invalid() from None
        import concierge
        def installed(model):
            try:
                return model in concierge.installed_models()
            except concierge.ConciergeError:
                raise SettingsError("model_unavailable", "Ollama's installed models could not be checked. Try again when Ollama is available.", 503) from None
        handler.json_response(200, update_document(payload, model_validator=installed))
    except SettingsError as error:
        handler.json_response(error.status, {"error": error.message, "code": error.code})
    return True

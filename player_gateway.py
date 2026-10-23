"""Same-origin wall gateway to the separate Aries player. No media credentials."""
import json
import re
import math
import threading
import time
import personal_library
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ROUTES = {
    "/api/player/status": "/status",
    "/api/player/play": "/play",
    "/api/player/sources": "/sources",
    "/api/player/command": "/command",
}


def configure(server, token_file, player_port=8791):
    server.player_token = None
    server.player_port = player_port
    server.progress_lock = threading.RLock()
    server.progress_seen = {}
    if token_file:
        path = Path(token_file)
        token = path.read_text(encoding="utf-8").strip()
        if path.stat().st_mode & 0o077 or not re.fullmatch(r"[A-Za-z0-9_-]{32,128}", token):
            raise ValueError("Player connection requires a private authentication file")
        server.player_token = token


def _resume(target):
    try:
        return personal_library.resume_position(target.get("imdb_id"), target.get("type", "movie"),
                                                target.get("season"), target.get("episode"))
    except personal_library.LibraryError:
        return 0


def _observe_progress(server, result, force=False):
    """Persist only observed adapter progress through the existing library owner."""
    lock = getattr(server, "progress_lock", None)
    if lock is None or result.get("state") not in ("playing", "paused", "ended"):
        return
    item_id, kind = result.get("imdb_id"), result.get("type", "movie")
    season, episode = result.get("season"), result.get("episode")
    position, duration = result.get("position"), result.get("duration")
    if not isinstance(item_id, str) or not re.fullmatch(r"tt[0-9]{5,12}", item_id) or kind not in ("movie", "series"):
        return
    if kind == "series" and (type(season) is not int or type(episode) is not int or season < 0 or episode < 1):
        return
    if any(type(v) not in (int, float) or not math.isfinite(v) for v in (position, duration)) or not 0 <= position <= duration <= 86400 or duration <= 0:
        return
    key = (item_id, kind, season, episode)
    with lock:
        if not force and time.monotonic() - server.progress_seen.get(key, 0) < 10:
            return
        try:
            personal_library.record_progress(item_id, kind, int(position * 1000), int(duration * 1000),
                                             position >= duration * .95, season, episode)
            server.progress_seen[key] = time.monotonic()
            if len(server.progress_seen) > 32:
                del server.progress_seen[next(iter(server.progress_seen))]
        except personal_library.LibraryError:
            # A history write failure must not interrupt playback or falsely claim it saved.
            result["history_saved"] = False


def handle(handler):
    route = urlsplit(handler.path).path
    if route not in ROUTES:
        handler.json_response(404, {"error": "Not found"})
        return
    port = handler.server.server_port
    hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}
    if handler.headers.get("Host") not in hosts:
        handler.json_response(400, {"error": "Use the local Movie Night address"})
        return
    if handler.command == "OPTIONS":
        handler.json_response(403, {"error": "Use the Movie Night controls"})
        return
    if handler.command not in ("GET", "HEAD", "POST") or (route == "/api/player/status") != (handler.command in ("GET", "HEAD")):
        handler.json_response(405, {"error": "Unsupported request"})
        return
    body = None
    if handler.command == "POST":
        origin = handler.headers.get("Origin")
        if (handler.headers.get("X-Movie-Night") != "1"
                or (origin and origin not in {"http://" + h for h in hosts})
                or handler.headers.get("Sec-Fetch-Site") == "cross-site"):
            handler.json_response(403, {"error": "Use the Movie Night controls"})
            return
        try:
            length = int(handler.headers.get("Content-Length", "0"))
            if (not 0 < length <= 8192 or handler.headers.get("Transfer-Encoding")
                    or handler.headers.get("Content-Type", "").split(";")[0].strip() != "application/json"):
                raise ValueError()
            handler.connection.settimeout(10)
            data = json.loads(handler.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError()
            if route == "/api/player/play":
                if "start_seconds" in data or ("resume" in data and type(data["resume"]) is not bool):
                    raise ValueError()
                resume = data.pop("resume", False)
                if resume:
                    data["start_seconds"] = _resume(data)
            body = json.dumps(data).encode("utf-8")
        except (ValueError, OSError):
            handler.json_response(400, {"error": "Invalid player request"})
            return
    token = getattr(handler.server, "player_token", None)
    if not token:
        handler.json_response(503, {"state": "offline", "client": "aries", "error": "Aries player is not connected"})
        return
    # Capture the outgoing session before an explicit stop or replacement.
    if body is not None and (route == "/api/player/play" or (route == "/api/player/command" and data.get("command") in ("stop", "pause"))):
        try:
            previous = Request(f"http://127.0.0.1:{handler.server.player_port}/status",
                               headers={"Authorization": "Bearer " + token})
            with urlopen(previous, timeout=4) as response:
                observed = json.loads(response.read(262145))
            if isinstance(observed, dict):
                _observe_progress(handler.server, observed, force=True)
        except (OSError, ValueError, URLError):
            pass
    request = Request(f"http://127.0.0.1:{handler.server.player_port}" + ROUTES[route], data=body,
                      headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
                      method="POST" if body is not None else "GET")
    try:
        try:
            response = urlopen(request, timeout=40 if body is not None else 4)
        except HTTPError as exc:
            response = exc
        with response:
            raw = response.read(262145)
            if len(raw) > 262144:
                raise ValueError()
            result = json.loads(raw)
            if not isinstance(result, dict):
                raise ValueError()
            if response.code == 200 and route == "/api/player/status":
                _observe_progress(handler.server, result)
            elif response.code == 200 and route == "/api/player/sources":
                result["resume_position"] = _resume(result)
            handler.json_response(response.code, result)
    except (OSError, ValueError, URLError):
        handler.json_response(503, {"state": "offline", "client": "aries", "error": "Aries player is not connected"})

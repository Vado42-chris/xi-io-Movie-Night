"""Same-origin wall gateway to the separate Aries player. No media credentials."""
import json
import re
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
    if token_file:
        path = Path(token_file)
        token = path.read_text(encoding="utf-8").strip()
        if path.stat().st_mode & 0o077 or not re.fullmatch(r"[A-Za-z0-9_-]{32,128}", token):
            raise ValueError("Player connection requires a private authentication file")
        server.player_token = token


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
            body = json.dumps(data).encode("utf-8")
        except (ValueError, OSError):
            handler.json_response(400, {"error": "Invalid player request"})
            return
    token = getattr(handler.server, "player_token", None)
    if not token:
        handler.json_response(503, {"state": "offline", "client": "aries", "error": "Aries player is not connected"})
        return
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
            handler.json_response(response.code, result)
    except (OSError, ValueError, URLError):
        handler.json_response(503, {"state": "offline", "client": "aries", "error": "Aries player is not connected"})

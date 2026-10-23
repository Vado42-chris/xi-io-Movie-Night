#!/usr/bin/env python3
"""Personal poster wall, catalogue, and same-origin playback controls.

The wall reads public movie data and a private local controller token. The
separate Aries controller reads existing add-on settings and resolves streams;
provider credentials and media URLs never enter this web server or frontend.
"""

import argparse
import json
import mimetypes
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit
import player_gateway
import concierge
import catalogue_browse
import ai_suggestions
import personal_library
import app_settings
import filter_cubes

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
WEB = ROOT / "web"
STUDIO_WEB = ROOT / "studio-web"
SAFE_ID = re.compile(r"^[a-zA-Z0-9_-]+$")
IMDB_ID = re.compile(r"^tt[0-9]+$")
ASSETS = {
    "/player-mini.mjs": ("player-mini.mjs", "text/javascript; charset=utf-8"),
    "/settings-contract.mjs": ("settings-contract.mjs", "text/javascript; charset=utf-8"),
    "/filter-cubes.mjs": ("filter-cubes.mjs", "text/javascript; charset=utf-8"),
    "/episode-autonext.mjs": ("episode-autonext.mjs", "text/javascript; charset=utf-8"),
    "/episode-auto-ui.mjs": ("episode-auto-ui.mjs", "text/javascript; charset=utf-8"),
    "/filter-cubes.css": ("filter-cubes.css", "text/css; charset=utf-8"),
    "/": ("index.html", "text/html; charset=utf-8"),
    "/index.html": ("index.html", "text/html; charset=utf-8"),
    "/style.css": ("style.css", "text/css; charset=utf-8"),
    "/native-appearance.css": ("native-appearance.css", "text/css; charset=utf-8"),
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
}


def read_library():
    """Reload edited public collections on the next request, without a restart."""
    config = json.loads((DATA / "collections.json").read_text(encoding="utf-8"))
    collections = []
    collection_ids = set()
    for collection in config["collections"]:
        cid = collection["id"]
        if not SAFE_ID.fullmatch(cid) or cid in collection_ids:
            raise ValueError("Collection IDs must be unique safe names")
        collection_ids.add(cid)
        filename = collection["file"]
        if Path(filename).name != filename or not filename.endswith(".json"):
            raise ValueError("Collection files must be JSON files in data/")
        movies = json.loads((DATA / filename).read_text(encoding="utf-8"))
        seen = set()
        for movie in movies:
            imdb_id = movie["imdb_id"]
            if not IMDB_ID.fullmatch(imdb_id) or imdb_id in seen:
                raise ValueError("Each collection requires unique IMDb movie IDs")
            seen.add(imdb_id)
            if not movie.get("title") or not isinstance(movie.get("year"), int):
                raise ValueError("Each movie requires a title and year")
        collections.append({
            "id": cid,
            "name": collection["name"],
            "description": collection.get("description", ""),
            "movies": movies,
        })
    return {"title": config.get("title", "Movie Night"), "collections": collections}


def make_manifest(library):
    return {
        "id": "local.personal.movie-night",
        "version": "1.0.0",
        "name": library["title"],
        "description": "Personal curated movie shelves with cover art and IMDb IDs.",
        "types": ["movie"],
        "resources": [
            {"name": "catalog", "types": ["movie"]},
            {"name": "meta", "types": ["movie"], "idPrefixes": ["tt"]},
        ],
        "catalogs": [{
            "type": "movie",
            "id": collection["id"],
            "name": collection["name"],
            "extra": [
                {"name": "skip", "isRequired": False},
                {"name": "search", "isRequired": False},
            ],
        } for collection in library["collections"]],
        "behaviorHints": {"configurable": False, "configurationRequired": False},
    }


def make_meta(movie):
    meta = {
        "id": movie["imdb_id"],
        "type": "movie",
        "name": movie["title"],
        "releaseInfo": str(movie["year"]),
        "posterShape": "poster",
        "behaviorHints": {"defaultVideoId": movie["imdb_id"]},
    }
    for key in ("poster", "genres", "runtime", "description", "background", "director", "cast", "imdbRating"):
        if movie.get(key):
            meta[key] = movie[key]
    return meta


class Handler(BaseHTTPRequestHandler):
    server_version = "MovieNight/1.0"
    sys_version = ""

    def log_message(self, format, *args):
        # No per-request URLs or user searches in logs.
        pass

    def send_body(self, status, body, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        if not urlsplit(self.path).path.startswith("/api/"):
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
        self.send_header("Cache-Control", "no-store" if urlsplit(self.path).path.startswith("/api/") else "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        if content_type.startswith("text/html"):
            # WindowFrame hosts the existing wall in a same-origin iframe.
            # Studio's existing motion/resize components require inline styles.
            studio = urlsplit(self.path).path.startswith("/studio")
            style_policy = "'self' 'unsafe-inline' https://fonts.googleapis.com" if studio else "'self'"
            self.send_header("Content-Security-Policy", f"default-src 'self'; img-src 'self' https: data:; style-src {style_policy}; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self' ipc: http://ipc.localhost; frame-src 'self'; base-uri 'none'; frame-ancestors 'self'")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def json_response(self, status, payload):
        self.send_body(status, json.dumps(payload, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8")

    def do_OPTIONS(self):
        if ai_suggestions.handle(self):
            return
        if filter_cubes.handle(self) or app_settings.handle(self) or app_settings.gate_catalogue(self):
            return
        if personal_library.handle(self) or catalogue_browse.handle(self):
            return
        if concierge.handle(self):
            return
        if urlsplit(self.path).path.startswith("/api/player/"):
            player_gateway.handle(self)
            return
        self.send_body(204, b"", "text/plain")

    def do_POST(self):
        if ai_suggestions.handle(self):
            return
        if filter_cubes.handle(self) or app_settings.handle(self) or app_settings.gate_catalogue(self):
            return
        if personal_library.handle(self) or catalogue_browse.handle(self):
            return
        if urlsplit(self.path).path == "/api/concierge/save":
            self.save_concierge_collection()
            return
        if concierge.handle(self):
            return
        player_gateway.handle(self)

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        if ai_suggestions.handle(self):
            return
        if filter_cubes.handle(self) or app_settings.handle(self) or app_settings.gate_catalogue(self):
            return
        if personal_library.handle(self) or catalogue_browse.handle(self, personal_library.register_catalogue):
            return
        if concierge.handle(self):
            return
        if urlsplit(self.path).path.startswith("/api/player/"):
            player_gateway.handle(self)
            return
        allowed_hosts = {f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"}
        if self.headers.get("Host", "") not in allowed_hosts:
            self.json_response(400, {"error": "Use the local Movie Night address"})
            return
        parsed = urlsplit(self.path)
        path = unquote(parsed.path)
        try:
            if path in ASSETS:
                filename, content_type = ASSETS[path]
                self.send_body(200, (WEB / filename).read_bytes(), content_type)
                return
            if path in {"/studio", "/studio/", "/studio/index.html"}:
                self.send_body(200, (STUDIO_WEB / "index.html").read_bytes(), "text/html; charset=utf-8")
                return
            if path.startswith("/studio/assets/"):
                filename = path.removeprefix("/studio/assets/")
                if not re.fullmatch(r"[a-zA-Z0-9_.-]+", filename):
                    self.json_response(404, {"error": "Not found"})
                    return
                asset = STUDIO_WEB / "assets" / filename
                if not asset.is_file():
                    self.json_response(404, {"error": "Not found"})
                    return
                content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
                self.send_body(200, asset.read_bytes(), content_type)
                return
            library = read_library()
            if path == "/health.json":
                self.json_response(200, {"ok": True, "collections": len(library["collections"]), "movies": sum(len(c["movies"]) for c in library["collections"])})
                return
            if path == "/api/library.json":
                # Personal collections are visible only on the private wall API.
                # Public add-on manifests/catalogues continue to use public data.
                library["collections"] += personal_library.read_saved_collections()
                personal_library.register_catalogue([m for c in library["collections"] for m in c["movies"]])
                self.json_response(200, library)
                return
            if path == "/manifest.json":
                self.json_response(200, make_manifest(library))
                return
            catalog_match = re.fullmatch(r"/catalog/movie/([a-zA-Z0-9_-]+)(?:/(.*))?\.json", path)
            if catalog_match:
                cid, extras = catalog_match.groups()
                collection = next((c for c in library["collections"] if c["id"] == cid), None)
                if collection is None:
                    self.json_response(404, {"metas": []})
                    return
                # Preserve percent-encoded ampersands inside a search query.
                raw_parts = parsed.path.removesuffix(".json").split("/", 4)
                raw_extras = raw_parts[4] if len(raw_parts) > 4 else ""
                params = parse_qs(raw_extras or parsed.query)
                raw_skip = params.get("skip", ["0"])[0]
                if not raw_skip.isdigit():
                    self.json_response(400, {"error": "skip must be a nonnegative integer"})
                    return
                skip = int(raw_skip)
                query = params.get("search", [""])[0].casefold().strip()
                movies = collection["movies"]
                if query:
                    movies = [m for m in movies if query in (m["title"] + " " + str(m["year"])).casefold()]
                self.json_response(200, {"metas": [make_meta(m) for m in movies[skip:skip + 100]]})
                return
            meta_match = re.fullmatch(r"/meta/movie/(tt[0-9]+)\.json", path)
            if meta_match:
                imdb_id = meta_match.group(1)
                movie = next((m for c in library["collections"] for m in c["movies"] if m["imdb_id"] == imdb_id), None)
                self.json_response(200 if movie else 404, {"meta": make_meta(movie) if movie else None})
                return
            self.json_response(404, {"error": "Not found"})
        except (OSError, ValueError, KeyError, TypeError):
            # Never return local paths or file contents in an error.
            self.json_response(500, {"error": "Movie collection could not be loaded"})

    def save_concierge_collection(self):
        hosts = {f"127.0.0.1:{self.server.server_port}", f"localhost:{self.server.server_port}"}
        origin = self.headers.get("Origin")
        if (self.headers.get("Host") not in hosts or self.headers.get("X-Movie-Night") != "1"
                or (origin and origin not in {"http://" + host for host in hosts})
                or self.headers.get("Sec-Fetch-Site") == "cross-site"):
            self.json_response(403, {"error": "Use the Movie Night concierge"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if (not 0 < length <= 16384 or self.headers.get("Transfer-Encoding")
                    or self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json"):
                raise ValueError()
            self.connection.settimeout(10)
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise ValueError()
            payload = json.loads(raw)
            if not isinstance(payload, dict) or set(payload) - {"name", "description", "imdb_ids"}:
                raise ValueError()
            public_rows = [movie for collection in read_library()["collections"] for movie in collection["movies"]]
            personal_library.register_catalogue(public_rows)
            canonical = personal_library.known_titles()
            collection = personal_library.save_collection(payload.get("name"), payload.get("description", ""), payload.get("imdb_ids"), canonical)
            self.json_response(200, {"collection": collection})
        except personal_library.LibraryError as error:
            self.json_response(error.status, {"error": error.message})
        except (ValueError, OSError, TypeError, RecursionError):
            self.json_response(400, {"error": "The collection could not be saved"})


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8789)
    parser.add_argument("--player-token-file", help="Private key for the separate Aries controller")
    parser.add_argument("--player-port", type=int, default=8791)
    parser.add_argument("--check", action="store_true", help="Validate movie data and exit")
    args = parser.parse_args()
    library = read_library()
    personal_library.register_catalogue([m for c in library["collections"] for m in c["movies"]])
    if args.check:
        print(json.dumps({"valid": True, "collections": [{"id": c["id"], "movies": len(c["movies"])} for c in library["collections"]]}))
        return
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    player_gateway.configure(server, args.player_token_file, args.player_port)
    print(f"Movie Night: http://127.0.0.1:{args.port}/", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

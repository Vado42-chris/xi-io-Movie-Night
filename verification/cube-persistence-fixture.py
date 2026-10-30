#!/usr/bin/env python3
"""Isolated Movie Night persistence fixture, real filter_cubes.py, synthetic data.

Never uses Aries, Nuvio, the normal Movie Night store, or any playback adapter.
"""
import copy
import json
import os
from pathlib import Path
import sys
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import filter_cubes

HTML = r"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Movie Night persistence fixture</title></head>
<body>
  <section id="browse-controls-home"></section>
  <div id="film-grid"></div>
  <button id="browse-more" type="button">More</button>
  <div id="empty-state"></div>
  <script type="module">
    import {mountFilterCubes} from "/filter-cubes.mjs";
    window.unexpectedEffects = 0;
    window.presentationHistory = [];
    const host = {
      collections: () => [{id:"fixture-local",name:"Synthetic local",movies:[]}],
      current: () => { throw new Error("Fixture does not permit new content"); },
      sourceDefaults: () => null,
      poster: () => document.createElement("span"),
      summary: () => "Synthetic local fixture",
      evaluate: () => [],
      catalogueEnabled: () => false,
      activate: () => {},
      open: () => { window.unexpectedEffects += 1; },
      presentation: (...args) => {window.presentationHistory.push(args);},
      openFilters: () => {throw new Error("No fixture filters");},
      fetchPage: () => {throw new Error("No provider fetch permitted");},
    };
    window.cube = await mountFilterCubes(host);
    window.ready = true;
  </script>
</body></html>"""

ROW = {
    "id": "cube-a",
    "name": "Synthetic starting cube",
    "collectionId": "fixture-local",
    "browse": None,
    "filters": {
        "yearFrom": "", "yearTo": "", "include": [], "exclude": [],
        "genreMode": "any", "rating": 0, "runtime": "", "type": "", "watch": "",
    },
    "search": "", "genre": "", "sort": "title", "anchor": None,
}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def send_body(self, status, payload, media_type):
        self.send_response(status)
        self.send_header("Content-Type", media_type)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(payload)

    def json_response(self, status, data):
        self.send_body(status, json.dumps(data).encode("utf-8"), "application/json")

    def do_GET(self):
        if filter_cubes.handle(self):
            return
        path = urlsplit(self.path).path
        if path == "/fixture":
            self.send_body(200, HTML.encode("utf-8"), "text/html; charset=utf-8")
        elif path == "/filter-cubes.mjs":
            self.send_body(200, (ROOT / "web/filter-cubes.mjs").read_bytes(), "text/javascript; charset=utf-8")
        elif path == "/favicon.ico":
            self.send_body(204, b"", "text/plain")
        else:
            self.json_response(404, {"error": "Fixture route not available"})

    def do_POST(self):
        if filter_cubes.handle(self):
            return
        self.json_response(404, {"error": "Fixture denies other writes"})


def main():
    with tempfile.TemporaryDirectory(prefix="movie-night-cube-fixture-") as temp:
        filter_cubes.STORE = Path(temp) / "filter-cubes.json"
        seed = copy.deepcopy(filter_cubes.CONTRACT["default"])
        seed["rows"] = [ROW]
        seed["selected_id"] = ROW["id"]
        saved = filter_cubes.save_document(seed)
        assert saved["revision"] == 1 and filter_cubes.read_document() == saved
        with ThreadingHTTPServer(("127.0.0.1", 0), Handler) as server:
            print(json.dumps({
                "url": f"http://127.0.0.1:{server.server_port}",
                "schema": "movie-night.cube-persistence-fixture/v1",
                "initial_revision": saved["revision"],
            }), flush=True)
            server.serve_forever()


if __name__ == "__main__":
    main()

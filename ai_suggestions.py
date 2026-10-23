"""Movie Night read-only AI Suggestions donor preview from user's installed Nuvio addon.

NO Bin writes, NO preference writes, NO local worker launches, NO new listener,
NO public HEX route. This is not AI-filled BINS, Ward admission, or playlist.
Configured account-specific URLs never leave this server or enter logs.
"""
import json
import re
import threading
import time
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from urllib.request import build_opener, Request, HTTPRedirectHandler, ProxyHandler
from player.aries_adapter import java_properties, read_file
from catalogue_browse import normalize_record

ADDONS = Path.home() / ".var/app/com.nuvio.media.desktop/config/nuvio/nuvio_addons.properties"
ROUTE = "/api/ai-suggestions-preview"
IDS = {"movie": "aicat_list_172310", "series": "aicat_list_172311"}
CACHE_TTL = 600
MAX_BYTES = 262144
_lock = threading.RLock()
_cache = {}


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, target):
        return None


def _allowed_manifest(value):
    if not isinstance(value, str) or len(value) > 15000:
        return False
    try:
        p = urlsplit(value)
        return (p.scheme == "https" and p.hostname == "bingecat.com"
                and p.port in (None, 443) and p.username is None and p.password is None
                and p.fragment == "" and p.path.endswith("/manifest.json")
                and bool(re.fullmatch(r"/(?:[A-Za-z0-9_.~%-]+/)+manifest\.json", p.path))
                and not re.search(r"(?i)%0[ad]|%2e%2e", value)
                and not any(ord(c) < 33 or ord(c) == 127 for c in value))
    except ValueError:
        return False


def _configured_url():
    properties = java_properties(read_file(ADDONS, 1024 * 1024))
    urls = json.loads(properties["installed_addon_urls_1"])
    enabled = json.loads(properties.get("addon_enabled_states_1", "{}"))
    if not isinstance(urls, list) or not isinstance(enabled, dict):
        raise ValueError("invalid installed Nuvio configuration")
    for value in urls:
        if (_allowed_manifest(value) and enabled.get(value, True) is True):
            return value
    raise ValueError("no enabled AI recommendation addon")


def _fetch_json(url):
    """Never follows redirects or proxies, never emits URL or query to logs."""
    opener = build_opener(ProxyHandler({}), _NoRedirect())
    with opener.open(Request(url, method="GET", headers={
        "Accept": "application/json",
        "User-Agent": "MovieNightLocalSuggestionPreview/1.0"
    }), timeout=12) as response:
        if response.status != 200:
            raise ValueError("provider not available")
        body = response.read(MAX_BYTES + 1)
    if len(body) > MAX_BYTES:
        raise ValueError("provider response too large")
    return json.loads(body)


def _recommendations(media_type):
    manifest = _configured_url()
    url = urlsplit(manifest)
    root = url.path[:-len("/manifest.json")]
    # Exact fixed addon feed IDs, not user-supplied routes or arbitrary URLs.
    path = root + "/catalog/" + media_type + "/" + IDS[media_type] + ".json"
    target = urlunsplit(("https", "bingecat.com", path, url.query, ""))
    result = _fetch_json(target)
    if not isinstance(result, dict) or not isinstance(result.get("metas"), list):
        raise ValueError("invalid recommendation feed")
    rows, seen = [], set()
    for position, raw in enumerate(result["metas"][:100]):
        record = normalize_record(raw, media_type, position + 1)
        if record is None:
            continue
        key = record["type"] + ":" + record["imdb_id"]
        if key in seen:
            continue
        seen.add(key)
        rows.append(record)
    return rows[:50]


def read_preview(media_type):
    if media_type not in IDS:
        raise ValueError("media type unsupported")
    now = time.monotonic()
    with _lock:
        row = _cache.get(media_type)
        if row and row["expiry"] > now:
            return {"state": "ready", "source": "BingeCat AI Recommendations",
                    "media_type": media_type, "movies": row["movies"],
                    "count": len(row["movies"]), "snapshot": True}
    try:
        rows = _recommendations(media_type)
        if not rows:
            raise ValueError("no recommendation records")
        with _lock:
            _cache[media_type] = {"expiry": now + CACHE_TTL, "movies": rows}
        return {"state": "ready", "source": "BingeCat AI Recommendations",
                "media_type": media_type, "movies": rows, "count": len(rows),
                "snapshot": True}
    except Exception:
        # No leakage of account URL, exception repr or personal addon metadata.
        with _lock:
            row = _cache.get(media_type)
        if row and row["movies"]:
            return {"state": "cached", "source": "BingeCat AI Recommendations",
                    "media_type": media_type, "movies": row["movies"],
                    "count": len(row["movies"]), "snapshot": True,
                    "message": "Using previously retrieved suggestions; provider unavailable."}
        return {"state": "unavailable", "source": "BingeCat AI Recommendations",
                "media_type": media_type, "movies": [], "count": 0,
                "snapshot": False,
                "message": "AI suggestions are unavailable. Your regular Bins still work."}


def handle(handler):
    path = urlsplit(handler.path)
    if path.path != ROUTE:
        return False
    hosts = {f"127.0.0.1:{handler.server.server_port}",
             f"localhost:{handler.server.server_port}"}
    if handler.headers.get("Host") not in hosts or handler.headers.get("Sec-Fetch-Site") == "cross-site":
        handler.json_response(403, {"error": "Unavailable outside Movie Night"})
        return True
    if handler.command not in ("GET", "HEAD"):
        handler.json_response(405, {"error": "Read-only suggestions"})
        return True
    if path.query not in ("type=movie", "type=series"):
        handler.json_response(400, {"error": "Choose movie or series"})
        return True
    handler.json_response(200, read_preview(path.query.split("=")[1]))
    return True

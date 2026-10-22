#!/usr/bin/env python3
"""Private, loopback-only bridge to an independent mpv process.

Nuvio properties are read only. Provider URLs and playback headers stay in memory
and private mpv IPC. This program never launches or controls Nuvio.
"""

import argparse
import errno
import hashlib
import hmac
import ipaddress
import json
import math
import os
import queue
import re
import secrets
import socket
import stat
import struct
import subprocess
import sys
import threading
import time
import unicodedata
import urllib.request
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import app_settings

MAX_BODY = 8192
MAX_PROVIDER_BODY = 2 * 1024 * 1024
SOURCE_TTL = 300
IMDB = re.compile(r"tt[0-9]{5,12}\Z")
OPAQUE = re.compile(r"[A-Za-z0-9_-]{24,64}\Z")
HEADER = re.compile(r"[!#$%&'*+.^_`|~0-9A-Za-z-]+\Z")
ERRORS = {
    "bad_request": "Invalid request.",
    "unauthorized": "Authentication required.",
    "forbidden": "This endpoint accepts local server requests only.",
    "not_found": "Endpoint not found.",
    "config_unavailable": "The existing add-on configuration is unavailable.",
    "addon_unavailable": "No enabled Torrentio configuration was found.",
    "addon_ambiguous": "More than one enabled Torrentio configuration was found.",
    "plugin_disabled": "Enable Torrentio in Movie Night settings to search for sources.",
    "settings_unavailable": "Movie Night settings are unavailable.",
    "provider_unavailable": "The configured source provider could not be reached.",
    "source_timeout": "The source provider did not respond in time.",
    "no_cached_sources": "No confirmed cached Real-Debrid sources were returned.",
    "source_expired": "That source expired or does not match this movie. Search again.",
    "busy": "Another playback request is in progress. Try again shortly.",
    "player_unavailable": "The independent player is unavailable.",
    "player_failed": "The independent player could not start playback.",
    "internal_error": "The request could not be completed.",
}


class SafeError(Exception):
    def __init__(self, code, status=400):
        self.code = code if code in ERRORS else "internal_error"
        self.status = status
        super().__init__(ERRORS[self.code])


def current_settings():
    try:
        return app_settings.read_settings()
    except app_settings.SettingsError:
        raise SafeError("settings_unavailable", 503) from None


def selection_profile(manifest, settings=None):
    """Bind private source IDs to the provider and current source preferences."""
    settings = current_settings() if settings is None else settings
    if not settings["plugins"]["torrentio_enabled"]:
        raise SafeError("plugin_disabled", 503)
    playback = settings["playback"]
    profile = {"quality": playback["preferred_quality"], "small": playback["prefer_small_encodes"]}
    digest = hashlib.sha256((manifest + "\n" + json.dumps(profile, sort_keys=True)).encode()).hexdigest()
    return profile, digest


def source_size(stream, text):
    """Use a bounded provider size hint only to order already cached sources."""
    hints = stream.get("behaviorHints")
    size = hints.get("videoSize") if isinstance(hints, dict) else None
    if type(size) in (int, float) and math.isfinite(size) and 0 < size <= 1024 ** 4:
        return size
    match = re.search(r"(?<![\d.])(\d{1,4}(?:\.\d{1,3})?)\s*(KiB|MiB|GiB|TiB|KB|MB|GB|TB)\b", text, re.I)
    if match:
        unit = match.group(2).upper().replace("I", "")
        size = float(match.group(1)) * (1024 ** {"KB": 1, "MB": 2, "GB": 3, "TB": 4}[unit])
        if 0 < size <= 1024 ** 4:
            return size
    return float("inf")


def read_file(path, limit, private=False):
    """Read without following a final symlink; never include paths in errors."""
    try:
        fd = os.open(str(path), os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
        with os.fdopen(fd, "rb") as handle:
            info = os.fstat(handle.fileno())
            if not stat.S_ISREG(info.st_mode) or info.st_size > limit:
                raise ValueError()
            if private and (info.st_uid != os.getuid() or info.st_mode & 0o077):
                raise ValueError()
            data = handle.read(limit + 1)
            if len(data) > limit:
                raise ValueError()
            return data
    except Exception:
        raise SafeError("config_unavailable", 503) from None


def properties_decode(value):
    def replace(match):
        escape = match.group(1)
        if escape.startswith("u"):
            return chr(int(escape[1:], 16))
        return {"t": "\t", "r": "\r", "n": "\n", "f": "\f"}.get(escape, escape)
    return re.sub(r"\\(u[0-9A-Fa-f]{4}|.)", replace, value)


def java_properties(data):
    """Java Properties.load(InputStream) escaping and continuation handling."""
    result, pending = {}, ""
    for raw in data.decode("iso-8859-1").splitlines():
        line = pending + (raw.lstrip(" \t\f") if pending else raw)
        slashes = len(line) - len(line.rstrip("\\"))
        if slashes % 2:
            pending = line[:-1]
            continue
        pending = ""
        line = line.lstrip(" \t\f")
        if not line or line[0] in "#!":
            continue
        index, escaped = 0, False
        while index < len(line):
            char = line[index]
            if not escaped and char in "=: \t\f":
                break
            escaped = not escaped if char == "\\" else False
            index += 1
        key = properties_decode(line[:index])
        rest = line[index:].lstrip(" \t\f")
        if rest[:1] in ("=", ":"):
            rest = rest[1:]
        result[key] = properties_decode(rest.lstrip(" \t\f"))
    return result


def movie_input(payload):
    imdb_id = payload.get("imdb_id")
    title = payload.get("title", imdb_id)
    if not isinstance(imdb_id, str) or not IMDB.fullmatch(imdb_id):
        raise SafeError("bad_request")
    if not isinstance(title, str) or not 1 <= len(title.strip()) <= 200:
        raise SafeError("bad_request")
    if any(unicodedata.category(c).startswith("C") for c in title) or "://" in title:
        raise SafeError("bad_request")
    return imdb_id, title.strip()


def configured_manifest(path):
    try:
        values = java_properties(read_file(path, 1024 * 1024))
        urls = json.loads(values["installed_addon_urls_1"])
        enabled = json.loads(values.get("addon_enabled_states_1", "{}"))
        if not isinstance(urls, list) or not isinstance(enabled, dict):
            raise ValueError()
        candidates = []
        for url in urls:
            if not isinstance(url, str) or len(url) > 16000:
                continue
            # Nuvio defaults a missing enabled-state entry to true.
            if enabled.get(url, True) is not True:
                continue
            p = urlsplit(url)
            if (p.scheme == "https" and p.hostname == "torrentio.strem.fun"
                    and p.port in (None, 443) and not p.username and not p.password
                    and not p.query and not p.fragment and p.path.endswith("/manifest.json")
                    and not any(ord(c) < 33 or ord(c) == 127 for c in url)):
                if url not in candidates:
                    candidates.append(url)
        if not candidates:
            raise SafeError("addon_unavailable", 409)
        if len(candidates) != 1:
            raise SafeError("addon_ambiguous", 409)
        return candidates[0]
    except SafeError:
        raise
    except Exception:
        raise SafeError("config_unavailable", 503) from None


def valid_media_url(value):
    if not isinstance(value, str) or not 1 <= len(value) <= 16000:
        return False
    if "\\" in value or any(ord(c) <= 32 or ord(c) == 127 for c in value):
        return False
    try:
        p = urlsplit(value)
        if p.scheme != "https" or not p.hostname or p.username or p.password or p.fragment:
            return False
        if p.port not in (None, 443):
            return False
        host = p.hostname.lower()
        if host == "localhost" or host.endswith((".localhost", ".local", ".internal", ".lan")):
            return False
        try:
            return ipaddress.ip_address(host).is_global
        except ValueError:
            return "." in host and bool(re.fullmatch(r"[a-zA-Z0-9.-]+", host))
    except ValueError:
        return False


def stream_headers(stream):
    hints = stream.get("behaviorHints") or {}
    if not isinstance(hints, dict):
        raise ValueError()
    proxy = hints.get("proxyHeaders") or {}
    if not isinstance(proxy, dict):
        raise ValueError()
    headers = proxy.get("request") or {}
    if not isinstance(headers, dict) or len(headers) > 32:
        raise ValueError()
    output, seen = [], set()
    for name, value in headers.items():
        if not isinstance(name, str) or not HEADER.fullmatch(name) or name.lower() in seen:
            raise ValueError()
        if name.lower() in {"host", "connection", "content-length", "transfer-encoding", "upgrade"}:
            raise ValueError()
        if (not isinstance(value, str) or len(value) > 8192
                or any(ord(c) < 32 or ord(c) > 255 for c in value)):
            raise ValueError()
        output.append(name + ": " + value)
        seen.add(name.lower())
    if sum(len(h) for h in output) > 16384:
        raise ValueError()
    return output


@dataclass(repr=False)
class Source:
    id: str
    imdb_id: str
    title: str
    quality: str
    label: str
    expires: float
    provider_digest: str
    url: str = field(repr=False)
    headers: list = field(repr=False)

    def public(self):
        return {"id": self.id, "label": self.label, "quality": self.quality}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise SafeError("provider_unavailable", 502)


class Resolver:
    def __init__(self, addons_file):
        self.addons_file = Path(addons_file)
        self.cache = {}
        self.lock = threading.Lock()
        self.fetch_slots = threading.BoundedSemaphore(2)

    def manifest(self):
        return configured_manifest(self.addons_file)

    def selection(self):
        settings = current_settings()
        if not settings["plugins"]["torrentio_enabled"]:
            raise SafeError("plugin_disabled", 503)
        manifest = self.manifest()
        profile, digest = selection_profile(manifest, settings)
        return manifest, profile, digest

    def plugin_status(self):
        """Configuration readback only. Never return a manifest, key or media URL."""
        try:
            self.manifest()
            return {"torrentio": {"configured": True, "status": "configured"}}
        except SafeError as error:
            code = error.code if error.code in ("addon_unavailable", "addon_ambiguous", "config_unavailable") else "config_unavailable"
            return {"torrentio": {"configured": False, "status": code}}

    def fetch(self, url):
        """Bound caller latency even when DNS or a remote body stalls."""
        if not self.fetch_slots.acquire(blocking=False):
            raise SafeError("busy", 503)
        result = queue.Queue(maxsize=1)

        def worker():
            try:
                opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
                req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "MovieNight-Aries/1"})
                with opener.open(req, timeout=20) as response:
                    if response.status != 200:
                        raise ValueError()
                    data = response.read(MAX_PROVIDER_BODY + 1)
                    if len(data) > MAX_PROVIDER_BODY:
                        raise ValueError()
                parsed = json.loads(data)
                if not isinstance(parsed, dict) or not isinstance(parsed.get("streams"), list):
                    raise ValueError()
                result.put((True, parsed["streams"][:500]))
            except Exception:
                result.put((False, None))
            finally:
                self.fetch_slots.release()

        threading.Thread(target=worker, daemon=True).start()
        try:
            ok, value = result.get(timeout=24)
        except queue.Empty:
            raise SafeError("source_timeout", 504) from None
        if not ok:
            raise SafeError("provider_unavailable", 502)
        return value

    def sources(self, imdb_id, title):
        manifest, profile, digest = self.selection()
        now = time.monotonic()
        with self.lock:
            self.cache = {key: source for key, source in self.cache.items() if source.expires > now}
            existing = [s for s in self.cache.values() if s.imdb_id == imdb_id and s.provider_digest == digest]
            if existing:
                return existing
        p = urlsplit(manifest)
        endpoint = urlunsplit(("https", "torrentio.strem.fun", p.path[:-len("manifest.json")] + "stream/movie/" + imdb_id + ".json", "", ""))
        qualities = ["1080p", "720p", "2160p", "480p", "360p", "unknown"]
        if profile["quality"] != "balanced":
            qualities.remove(profile["quality"])
            qualities.insert(0, profile["quality"])
        candidates, seen = [], set()
        for stream in self.fetch(endpoint):
            if not isinstance(stream, dict) or "externalUrl" in stream:
                continue
            name = stream.get("name", "")
            if not isinstance(name, str) or len(name) > 1000:
                continue
            # Positive RD+ evidence is mandatory. Never probe an uncertain URL.
            if not re.search(r"(?<![A-Za-z0-9])RD\+(?![A-Za-z0-9])", name, re.I):
                continue
            if re.search(r"uncached|not\s+cached|download|unavailable", name, re.I):
                continue
            url = stream.get("url")
            if not valid_media_url(url) or url in seen:
                continue
            try:
                headers = stream_headers(stream)
            except ValueError:
                continue
            text = name + " " + str(stream.get("title", ""))[:3000]
            quality_match = re.search(r"(?<![0-9])(2160|1080|720|480|360)p\b", text, re.I)
            quality = quality_match.group(1) + "p" if quality_match else ("2160p" if re.search(r"\b4k\b", text, re.I) else "unknown")
            rank = qualities.index(quality)
            heavy = bool(re.search(r"\b(?:remux|dolby.?vision|hdr|dv)\b", text, re.I))
            ordering = (rank, heavy, source_size(stream, text)) if profile["small"] else (rank,)
            candidates.append((ordering, quality, url, headers))
            seen.add(url)
        candidates.sort(key=lambda item: item[0])
        # A preferences/provider change during a source request invalidates that
        # response, just as it invalidates a source selected from an older list.
        if self.selection()[2] != digest:
            raise SafeError("source_expired", 409)
        sources = []
        for index, (_, quality, url, headers) in enumerate(candidates[:24], 1):
            sources.append(Source(secrets.token_urlsafe(24), imdb_id, title, quality,
                                  quality + " · RD cached · Source " + str(index),
                                  time.monotonic() + SOURCE_TTL, digest, url, headers))
        with self.lock:
            # Bound private in-memory cache; never persist provider payloads.
            while len(self.cache) + len(sources) > 256 and self.cache:
                self.cache.pop(next(iter(self.cache)))
            for source in sources:
                self.cache[source.id] = source
        return sources

    def get(self, source_id, imdb_id):
        if not isinstance(source_id, str) or not OPAQUE.fullmatch(source_id):
            raise SafeError("source_expired", 409)
        digest = self.selection()[2]
        with self.lock:
            source = self.cache.get(source_id)
            if (not source or source.expires <= time.monotonic() or source.imdb_id != imdb_id
                    or source.provider_digest != digest):
                raise SafeError("source_expired", 409)
            return source


class Player:
    def __init__(self, socket_path, command_file, selection_file=None):
        self.path = Path(socket_path)
        self.command_file = Path(command_file)
        self.selection_file = Path(selection_file) if selection_file else None
        self.lock = threading.RLock()
        self.process = None
        self.imdb_id = None
        self.title = None
        self.loading_since = None
        self.has_played = False
        self.last_error = None
        self.muted = False
        self.fullscreen = False
        self.stop_requested = False
        if self.selection_file and self.selection_file.exists():
            try:
                selection = json.loads(read_file(self.selection_file, 4096, private=True))
                self.imdb_id, self.title = movie_input(selection)
                self.has_played = True
            except (SafeError, ValueError, TypeError):
                pass

    def save_selection(self):
        """Retain only the selected title/IMDb ID for controller handoff."""
        if not self.selection_file:
            return
        try:
            parent = self.selection_file.parent.lstat()
            if not stat.S_ISDIR(parent.st_mode) or parent.st_uid != os.getuid() or parent.st_mode & 0o077:
                return
            if not self.imdb_id:
                if self.selection_file.exists():
                    read_file(self.selection_file, 4096, private=True)
                    self.selection_file.unlink()
                return
            temporary = self.selection_file.with_name(self.selection_file.name + "." + secrets.token_hex(8))
            fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump({"imdb_id": self.imdb_id, "title": self.title}, handle)
            os.replace(temporary, self.selection_file)
        except (OSError, SafeError):
            # A metadata write must not disturb an already running film.
            pass

    def validate_socket(self):
        try:
            parent = self.path.parent.lstat()
            info = self.path.lstat()
            if (not stat.S_ISDIR(parent.st_mode) or parent.st_uid != os.getuid() or parent.st_mode & 0o077
                    or not stat.S_ISSOCK(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077):
                raise ValueError()
            return info
        except Exception:
            raise SafeError("player_unavailable", 503) from None

    def socket_state(self):
        """Probe only our private socket; never remove a live or unknown socket."""
        try:
            self.path.lstat()
        except FileNotFoundError:
            return "missing", None
        except OSError:
            raise SafeError("player_unavailable", 503) from None
        info = self.validate_socket()
        try:
            with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as conn:
                conn.settimeout(0.5)
                conn.connect(str(self.path))
            return "live", info
        except OSError as exc:
            if exc.errno == errno.ECONNREFUSED:
                return "dead", info
            if exc.errno == errno.ENOENT:
                return "missing", None
            raise SafeError("player_unavailable", 503) from None

    def process_running(self):
        return self.process is not None and self.process.poll() is None

    def configured_command(self):
        """Return only the existing private executable/argument configuration."""
        command = json.loads(read_file(self.command_file, 32768, private=True))
        if (not isinstance(command, list) or not command or len(command) > 64
                or any(not isinstance(a, str) or not a or "\x00" in a or "://" in a for a in command)
                or not Path(command[0]).is_absolute()):
            raise SafeError("player_unavailable", 503)
        return command

    @staticmethod
    def process_stamp(pid):
        """Linux process identity/state, including start ticks to detect PID reuse."""
        process = Path("/proc") / str(pid)
        uid = process.stat().st_uid
        with (process / "stat").open("r", encoding="ascii") as handle:
            raw = handle.read(4097)
        if len(raw) > 4096:
            raise ValueError()
        fields = raw.rsplit(")", 1)[1].split()
        return uid, int(fields[19]), fields[0]

    def stable_socket(self, expected):
        current = self.validate_socket()
        if (current.st_dev, current.st_ino) != (expected.st_dev, expected.st_ino):
            raise SafeError("player_unavailable", 503)

    def verified_player_peer(self, conn, socket_info):
        """Verify the connected peer, never a PID inferred from a window title."""
        self.stable_socket(socket_info)
        credentials = conn.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, struct.calcsize("3i"))
        pid, uid, _ = struct.unpack("3i", credentials)
        if pid <= 1 or uid != os.getuid():
            raise SafeError("player_unavailable", 503)
        process_uid, started, state = self.process_stamp(pid)
        expected_exe = Path(self.configured_command()[0]).resolve(strict=True)
        actual_exe = (Path("/proc") / str(pid) / "exe").resolve(strict=True)
        if process_uid != uid or state in ("Z", "X") or actual_exe != expected_exe:
            raise SafeError("player_unavailable", 503)
        if self.process_running() and self.process.pid != pid:
            raise SafeError("player_unavailable", 503)
        self.stable_socket(socket_info)
        return pid, started

    @staticmethod
    def connected_window_id(conn):
        """Read wid on the same verified connection that may later receive quit."""
        request_id = secrets.randbelow(2**31)
        conn.sendall(json.dumps({"command": ["get_property", "wid"], "request_id": request_id}).encode() + b"\n")
        deadline = time.monotonic() + 2
        with conn.makefile("rb") as reader:
            for _ in range(128):
                conn.settimeout(max(0.01, deadline - time.monotonic()))
                line = reader.readline(65537)
                if not line or len(line) > 65536 or time.monotonic() > deadline:
                    break
                message = json.loads(line)
                if message.get("request_id") != request_id:
                    continue
                if message.get("error") != "success":
                    break
                value = message.get("data")
                if isinstance(value, str) and re.fullmatch(r"-1|[0-9]{1,10}", value):
                    value = int(value)
                if isinstance(value, int) and not isinstance(value, bool) and -1 <= value <= 0xFFFFFFFF:
                    return value
                break
        raise SafeError("player_unavailable", 503)

    def wait_for_player_exit(self, identity, socket_info):
        """Wait for the verified process to exit; never kill or unlink anything."""
        pid, started = identity
        deadline = time.monotonic() + 4
        while time.monotonic() < deadline:
            try:
                uid, current_started, state = self.process_stamp(pid)
                exited = current_started != started or state in ("Z", "X")
                if not exited and uid != os.getuid():
                    raise SafeError("player_unavailable", 503)
            except FileNotFoundError:
                exited = True
            if exited:
                if self.process is not None and self.process.pid == pid:
                    if self.process.poll() is None:
                        time.sleep(0.05)
                        continue
                    self.process = None
                socket_state, current = self.socket_state()
                if socket_state == "live":
                    raise SafeError("player_unavailable", 503)
                if socket_state == "dead" and (current.st_dev, current.st_ino) != (socket_info.st_dev, socket_info.st_ino):
                    raise SafeError("player_unavailable", 503)
                return
            time.sleep(0.05)
        raise SafeError("player_unavailable", 503)

    def prepare_embedding_for_play(self):
        """Only explicit new Play may replace a verified player with a new parent.

        Merely opening/preparing the shell, status, resume, and stop never call
        this method. No state-changing IPC is sent until all checks pass.
        """
        target = self.embed_target()
        if target is None:
            return
        try:
            state, socket_info = self.socket_state()
            if state != "live":
                return
            with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as conn:
                conn.settimeout(2)
                conn.connect(str(self.path))
                identity = self.verified_player_peer(conn, socket_info)
                if self.connected_window_id(conn) == target:
                    return
                # Recheck the parent, connected peer, and socket inode immediately
                # before quit. Reusing this connection avoids a reconnect race.
                if self.embed_target() != target or self.verified_player_peer(conn, socket_info) != identity:
                    raise SafeError("player_unavailable", 503)
                conn.sendall(b'{"command":["quit"]}\n')
                self.wait_for_player_exit(identity, socket_info)
        except Exception:
            # Unknown owners, races, and failed exits must not reach ensure/load.
            raise SafeError("player_unavailable", 503) from None

    def embed_target(self):
        """Accept only the live native surface created by our private shell."""
        receipt = self.path.parent / "embed-window.json"
        if not receipt.exists():
            return None
        try:
            data = json.loads(read_file(receipt, 4096, private=True))
            xid, pid = data.get("xid"), data.get("pid")
            if (data.get("schema") != "movie-night.embed-window/v1"
                    or data.get("backend") != "x11"
                    or not isinstance(xid, int) or isinstance(xid, bool) or not 0 < xid <= 0xFFFFFFFF
                    or not isinstance(pid, int) or isinstance(pid, bool) or pid <= 1):
                return None
            process = Path("/proc") / str(pid)
            expected = (self.path.parent / "bin/movie-night-desktop").resolve()
            if process.stat().st_uid != os.getuid() or (process / "exe").resolve() != expected:
                return None
            probe = subprocess.run(["/usr/bin/xwininfo", "-id", str(xid)],
                                   stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                                   stderr=subprocess.DEVNULL, timeout=2)
            return xid if probe.returncode == 0 else None
        except (SafeError, ValueError, OSError, subprocess.TimeoutExpired):
            return None

    def clear_playback(self, stopped=False):
        self.imdb_id = self.title = self.loading_since = None
        self.has_played = False
        self.last_error = None
        self.stop_requested = stopped
        self.save_selection()

    def snapshot(self):
        return {"client": "aries", "state": "idle", "imdb_id": self.imdb_id, "title": self.title,
                "position": None, "duration": None, "volume": None, "last_error": self.last_error,
                "muted": self.muted, "fullscreen": self.fullscreen}

    def ipc(self, command, optional=False):
        self.validate_socket()
        request_id = secrets.randbelow(2**31)
        try:
            with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as conn:
                conn.settimeout(2)
                conn.connect(str(self.path))
                conn.sendall(json.dumps({"command": command, "request_id": request_id}, ensure_ascii=False).encode() + b"\n")
                deadline = time.monotonic() + 2
                with conn.makefile("rb") as reader:
                    for _ in range(128):
                        conn.settimeout(max(0.01, deadline - time.monotonic()))
                        line = reader.readline(65537)
                        if not line or len(line) > 65536 or time.monotonic() > deadline:
                            break
                        message = json.loads(line)
                        if message.get("request_id") == request_id:
                            if message.get("error") != "success":
                                if optional:
                                    return None
                                raise SafeError("player_failed", 502)
                            return message.get("data")
        except SafeError:
            raise
        except Exception:
            pass
        raise SafeError("player_unavailable", 503)

    def ensure(self):
        state, info = self.socket_state()
        if state == "live":
            self.ipc(["get_property", "idle-active"])
            return
        if self.process_running():
            # Do not unlink a socket belonging to a process still starting up,
            # or launch a second copy while our existing host is alive.
            raise SafeError("player_unavailable", 503)
        if state == "dead":
            current = self.validate_socket()
            if (current.st_dev, current.st_ino) != (info.st_dev, info.st_ino):
                raise SafeError("player_unavailable", 503)
            try:
                self.path.unlink()
            except OSError:
                raise SafeError("player_unavailable", 503) from None
        try:
            self.path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            parent = self.path.parent.lstat()
            if not stat.S_ISDIR(parent.st_mode) or parent.st_uid != os.getuid() or parent.st_mode & 0o077:
                raise ValueError()
            command = self.configured_command()
            command += ["--no-config", "--idle=yes", "--force-window=no", "--terminal=no",
                        "--input-terminal=no", "--load-scripts=no", "--ytdl=no", "--log-file=",
                        "--save-position-on-quit=no", "--title=Movie Night",
                        "--input-ipc-server=" + str(self.path)]
            target = self.embed_target()
            if target:
                command += ["--wid=" + str(target), "--vo=gpu", "--gpu-context=x11egl",
                            "--osc=no", "--osd-bar=no", "--keep-open=no"]
            self.process = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                                            stderr=subprocess.DEVNULL, start_new_session=True, close_fds=True)
        except Exception:
            raise SafeError("player_unavailable", 503) from None
        deadline = time.monotonic() + 6
        while time.monotonic() < deadline:
            if self.process.poll() is not None:
                break
            if self.path.exists():
                try:
                    self.ipc(["get_property", "idle-active"])
                    return
                except SafeError:
                    pass
            time.sleep(0.05)
        raise SafeError("player_unavailable", 503)

    @staticmethod
    def number(value):
        return round(float(value), 3) if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) else None

    def status(self):
        with self.lock:
            result = self.snapshot()
            try:
                state, _ = self.socket_state()
                if state != "live":
                    if self.process_running() and self.imdb_id and not self.stop_requested:
                        result.update(state="error", last_error=ERRORS["player_unavailable"])
                    else:
                        self.clear_playback(stopped=self.stop_requested)
                        self.muted = self.fullscreen = False
                        result = self.snapshot()
                    return result
                idle = self.ipc(["get_property", "idle-active"])
                paused = self.ipc(["get_property", "pause"], optional=True)
                for target, prop in (("position", "time-pos"), ("duration", "duration"), ("volume", "volume")):
                    result[target] = self.number(self.ipc(["get_property", prop], optional=True))
                for target, prop in (("muted", "mute"), ("fullscreen", "fullscreen")):
                    value = self.ipc(["get_property", prop], optional=True)
                    if isinstance(value, bool):
                        setattr(self, target, value)
                    result[target] = getattr(self, target)
                if self.stop_requested:
                    result.update(state="idle", position=None, duration=None, last_error=None)
                elif idle:
                    if self.loading_since and not self.has_played:
                        if time.monotonic() - self.loading_since < 3:
                            result["state"] = "loading"
                        else:
                            self.last_error = ERRORS["player_failed"]
                            result.update(state="error", last_error=self.last_error)
                    else:
                        self.clear_playback()
                        result.update(imdb_id=None, title=None, position=None, duration=None, last_error=None)
                elif result["position"] is None:
                    result["state"] = "loading"
                else:
                    self.has_played = True
                    self.last_error = None
                    result["state"] = "paused" if paused else "playing"
                    result["last_error"] = None
            except SafeError as exc:
                # A normal window close may race the property reads.
                try:
                    state, _ = self.socket_state()
                except SafeError:
                    state = "unknown"
                if state in ("missing", "dead") and not self.process_running():
                    self.clear_playback()
                    self.muted = self.fullscreen = False
                    result = self.snapshot()
                else:
                    result.update(state="error", last_error=ERRORS[exc.code])
            return result

    def play(self, source):
        with self.lock:
            try:
                imdb_id, title = movie_input({"imdb_id": source.imdb_id, "title": source.title})
                volume = current_settings()["playback"]["default_volume"]
                self.prepare_embedding_for_play()
                self.ensure()
                # Reset on EVERY load, including an empty list, to avoid leaking
                # one source's request headers into a later source.
                self.ipc(["set_property", "http-header-fields", source.headers])
                # A default applies only to an explicit new play, never a
                # settings save, status read, or resume of the current film.
                self.ipc(["set_property", "volume", volume])
                # Set a literal media title; only this fixed window-title template
                # is expanded by mpv. Never display the provider's URL/filename.
                self.ipc(["set_property", "force-media-title", title])
                self.ipc(["set_property", "title", "${media-title} — Movie Night"])
                self.ipc(["set_property", "pause", False])
                self.ipc(["loadfile", source.url, "replace"])
                self.imdb_id, self.title = imdb_id, title
                self.save_selection()
                self.loading_since = time.monotonic()
                self.has_played = False
                self.last_error = None
                self.stop_requested = False
            except SafeError as exc:
                self.last_error = ERRORS[exc.code]
                raise
            return {"ok": True, "client": "aries", "state": "loading", "imdb_id": source.imdb_id, "title": source.title}

    def command(self, name, value=None):
        with self.lock:
            commands = {"pause": ["set_property", "pause", True], "resume": ["set_property", "pause", False],
                        "toggle": ["cycle", "pause"], "stop": ["stop"],
                        "mute": ["cycle", "mute"], "fullscreen": ["cycle", "fullscreen"]}
            if name in ("seek", "volume", "skip"):
                if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value):
                    raise SafeError("bad_request")
                if name == "seek" and 0 <= value <= 86400:
                    command = ["seek", value, "absolute+exact"]
                elif name == "volume" and 0 <= value <= 100:
                    command = ["set_property", "volume", value]
                elif name == "skip" and value in (-30, -10, -5, 5, 10, 30):
                    command = ["seek", value, "relative+exact"]
                else:
                    raise SafeError("bad_request")
            elif name in commands and value is None:
                command = commands[name]
            else:
                raise SafeError("bad_request")
            if name == "stop":
                stopped = False
                try:
                    state, _ = self.socket_state()
                    if state == "live":
                        try:
                            self.ipc(command)
                        except SafeError:
                            state, _ = self.socket_state()
                            if state not in ("missing", "dead") or self.process_running():
                                raise
                    elif self.process_running():
                        raise SafeError("player_unavailable", 503)
                    stopped = True
                finally:
                    self.clear_playback(stopped=stopped)
                return {"ok": True, **self.status()}
            self.ipc(command)
            return {"ok": True, **self.status()}


class Adapter:
    def __init__(self, resolver, player):
        self.resolver, self.player = resolver, player
        self.actions = threading.Lock()

    def post(self, path, payload):
        if path == "/sources":
            if set(payload) - {"imdb_id", "title"}:
                raise SafeError("bad_request")
            imdb_id, title = movie_input(payload)
            sources = self.resolver.sources(imdb_id, title)
            result = {"imdb_id": imdb_id, "sources": [s.public() for s in sources], "count": len(sources)}
            if not sources:
                result["reason"] = "no_cached_sources"
            return 200, result
        if path not in ("/play", "/command"):
            raise SafeError("not_found", 404)
        if not self.actions.acquire(blocking=False):
            raise SafeError("busy", 409)
        try:
            if path == "/play":
                if set(payload) - {"imdb_id", "title", "source_id"}:
                    raise SafeError("bad_request")
                imdb_id, title = movie_input(payload)
                if "source_id" in payload:
                    source = self.resolver.get(payload["source_id"], imdb_id)
                else:
                    sources = self.resolver.sources(imdb_id, title)
                    if not sources:
                        raise SafeError("no_cached_sources", 409)
                    source = sources[0]
                return 202, self.player.play(source)
            if set(payload) - {"command", "value"} or not isinstance(payload.get("command"), str):
                raise SafeError("bad_request")
            return 200, self.player.command(payload["command"], payload.get("value"))
        finally:
            self.actions.release()


class Handler(BaseHTTPRequestHandler):
    server_version = "MovieNightAries/1"
    sys_version = ""
    protocol_version = "HTTP/1.0"

    def setup(self):
        super().setup()
        self.connection.settimeout(5)

    def log_message(self, *args):
        pass

    def send_error(self, code, message=None, explain=None):
        self.reply(code, {"error": "bad_request", "message": ERRORS["bad_request"]})

    def reply(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Connection", "close")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (OSError, TimeoutError):
            pass
        self.close_connection = True

    def authenticate(self):
        hosts = self.headers.get_all("Host", [])
        if len(hosts) != 1 or hosts[0] not in {"127.0.0.1:" + str(self.server.server_port), "localhost:" + str(self.server.server_port)}:
            raise SafeError("forbidden", 403)
        if self.headers.get("Origin") is not None:
            raise SafeError("forbidden", 403)
        auth = self.headers.get_all("Authorization", [])
        expected = "Bearer " + self.server.token
        if len(auth) != 1 or not hmac.compare_digest(auth[0].encode(), expected.encode()):
            raise SafeError("unauthorized", 401)

    def handle_request(self, post=False):
        try:
            self.authenticate()
            if self.path not in ("/status", "/plugins", "/sources", "/play", "/command"):
                raise SafeError("not_found", 404)
            if not post:
                if self.path == "/plugins":
                    self.reply(200, self.server.adapter.resolver.plugin_status())
                    return
                if self.path != "/status":
                    raise SafeError("not_found", 404)
                self.reply(200, self.server.adapter.player.status())
                return
            if self.headers.get("Transfer-Encoding") or self.headers.get("Expect"):
                raise SafeError("bad_request")
            lengths = self.headers.get_all("Content-Length", [])
            if len(lengths) != 1 or not re.fullmatch(r"[0-9]{1,6}", lengths[0]):
                raise SafeError("bad_request")
            length = int(lengths[0])
            if not 1 <= length <= MAX_BODY or self.headers.get_content_type() != "application/json":
                raise SafeError("bad_request")
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise SafeError("bad_request")
            payload = json.loads(raw, parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))
            if not isinstance(payload, dict):
                raise SafeError("bad_request")
            code, result = self.server.adapter.post(self.path, payload)
            self.reply(code, result)
        except SafeError as exc:
            self.reply(exc.status, {"error": exc.code, "message": ERRORS[exc.code]})
        except (ValueError, UnicodeError, TimeoutError):
            self.reply(400, {"error": "bad_request", "message": ERRORS["bad_request"]})
        except Exception:
            self.reply(500, {"error": "internal_error", "message": ERRORS["internal_error"]})

    def do_GET(self):
        self.handle_request()

    def do_POST(self):
        self.handle_request(post=True)


class Server(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 8
    allow_reuse_address = True

    def __init__(self, port, adapter, token):
        self.adapter, self.token = adapter, token
        self.slots = threading.BoundedSemaphore(8)
        super().__init__(("127.0.0.1", port), Handler)

    def process_request(self, request, client_address):
        if not self.slots.acquire(blocking=False):
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self.slots.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.slots.release()

    def handle_error(self, request, client_address):
        # Never emit exception strings, request payloads, provider URLs or keys.
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--socket", required=True, type=Path)
    parser.add_argument("--token-file", required=True, type=Path)
    parser.add_argument("--player-command-file", required=True, type=Path)
    parser.add_argument("--selection-file", type=Path)
    parser.add_argument("--addons-file", type=Path, default=Path.home() / ".var/app/com.nuvio.media.desktop/config/nuvio/nuvio_addons.properties")
    parser.add_argument("--port", type=int, default=8791)
    args = parser.parse_args()
    os.umask(0o077)
    try:
        token = read_file(args.token_file, 1024, private=True).decode("ascii").strip()
        if not re.fullmatch(r"[A-Za-z0-9_-]{32,256}", token) or not args.socket.is_absolute() or not 1024 <= args.port <= 65535:
            raise SafeError("config_unavailable", 503)
        selection_file = args.selection_file or args.socket.parent / "selection.json"
        adapter = Adapter(Resolver(args.addons_file), Player(args.socket, args.player_command_file, selection_file))
        server = Server(args.port, adapter, token)
        print("Aries playback adapter ready on loopback.", flush=True)
        server.serve_forever(poll_interval=0.5)
    except KeyboardInterrupt:
        return 0
    except Exception:
        print("Aries playback adapter could not start; check private configuration.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

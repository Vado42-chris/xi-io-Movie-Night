"""Offline smoke test: no credentials, provider requests, or player process."""

import io
import json
import os
from pathlib import Path
import socket
import struct
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, Mock, patch

from aries_adapter import Adapter, Player, Resolver, SafeError


class FakePlayer(Player):
    def __init__(self):
        super().__init__("/unused/player.sock", "/unused/command.json")
        self.requests = []

    def ensure(self):
        pass

    def ipc(self, command, optional=False):
        self.requests.append(command)
        return None


class AdapterSmokeTest(unittest.TestCase):
    def test_cached_only_opaque_sources_and_secret_redaction(self):
        manifest = "https://torrentio.strem.fun/realdebrid=TEST_PROVIDER_SECRET/manifest.json"
        media = "https://cdn.example.com/TEST_MEDIA_SECRET/movie.mkv"
        with tempfile.TemporaryDirectory() as directory:
            props = Path(directory) / "addons.properties"
            original = ("installed_addon_urls_1=" + json.dumps([manifest]) + "\n"
                        + "addon_enabled_states_1=" + json.dumps({manifest: True}) + "\n")
            props.write_text(original)
            resolver = Resolver(props)
            resolver.fetch = lambda _: [
                {"name": "[RD+] Torrentio 2160p", "url": media + "?4k=1"},
                {"name": "[RD+] Torrentio 1080p", "url": media,
                 "behaviorHints": {"proxyHeaders": {"request": {"Authorization": "Bearer TEST_HEADER_SECRET"}}}},
                {"name": "[RD download] Torrentio 1080p", "url": "https://cdn.example.com/uncached"},
                {"name": "[RD+] Torrentio 1080p", "infoHash": "fake"},
                {"name": "[RD+] Torrentio 1080p", "url": "https://127.0.0.1/private"},
            ]
            player = FakePlayer()
            adapter = Adapter(resolver, player)
            code, result = adapter.post("/sources", {"imdb_id": "tt0093779", "title": "The Princess Bride"})
            self.assertEqual(code, 200)
            self.assertEqual(result["count"], 2)
            self.assertEqual(result["sources"][0]["quality"], "1080p")
            source_id = result["sources"][0]["id"]
            with self.assertRaises(SafeError) as caught:
                resolver.get(source_id, "tt0088763")
            self.assertEqual(caught.exception.code, "source_expired")
            code, playing = adapter.post("/play", {"imdb_id": "tt0093779", "title": "The Princess Bride", "source_id": source_id})
            self.assertEqual(code, 202)
            self.assertEqual(playing["state"], "loading")
            self.assertEqual(player.requests[0], ["set_property", "http-header-fields", ["Authorization: Bearer TEST_HEADER_SECRET"]])
            self.assertIn(["set_property", "force-media-title", "The Princess Bride"], player.requests)
            self.assertIn(["set_property", "title", "${media-title} — Movie Night"], player.requests)
            self.assertEqual(player.requests[-1], ["loadfile", media, "replace"])
            public = json.dumps([result, playing, str(caught.exception)])
            for forbidden in ("TEST_PROVIDER_SECRET", "TEST_MEDIA_SECRET", "TEST_HEADER_SECRET", "https://", "Authorization"):
                self.assertNotIn(forbidden, public)
            self.assertEqual(props.read_text(), original)


class PlayerControlTest(unittest.TestCase):
    def player(self, directory):
        player = Player(Path(directory) / "player.sock", Path(directory) / "command.json")
        player.imdb_id = "tt0111161"
        player.title = "The Shawshank Redemption"
        player.has_played = True
        player.last_error = "Old safe error"
        return player

    def bind(self, path, listening=False):
        conn = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        try:
            conn.bind(str(path))
        except PermissionError:
            conn.close()
            self.skipTest("This test environment forbids Unix socket binding")
        os.chmod(path, 0o600)
        if listening:
            conn.listen(16)
        return conn

    def test_stop_without_socket_is_idempotent_and_clears_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            player = self.player(directory)
            player.ipc = Mock(side_effect=AssertionError("Must not send IPC"))
            for _ in range(2):
                result = player.command("stop")
                self.assertTrue(result["ok"])
                self.assertEqual(result["state"], "idle")
                for key in ("title", "imdb_id", "last_error", "position", "duration"):
                    self.assertIsNone(result[key])
            player.ipc.assert_not_called()

    def test_closed_window_and_stop_with_dead_socket_report_clean_idle(self):
        with tempfile.TemporaryDirectory() as directory:
            player = self.player(directory)
            self.bind(player.path).close()
            player.ipc = Mock(side_effect=AssertionError("Must not send IPC"))
            result = player.status()
            self.assertEqual(result["state"], "idle")
            self.assertIsNone(result["title"])
            self.assertIsNone(result["last_error"])
            self.assertEqual(player.command("stop")["state"], "idle")
            self.assertTrue(player.path.exists())  # Reads/stop never remove sockets.

    def test_ensure_recovers_owned_dead_socket_and_preserves_explicit_script(self):
        with tempfile.TemporaryDirectory() as directory:
            player = self.player(directory)
            self.bind(player.path).close()
            player.command_file.write_text(json.dumps(["/private/mpv", "--script=/private/controls.lua"]))
            player.command_file.chmod(0o600)
            listeners = []
            def launch(argv, **kwargs):
                self.assertFalse(player.path.exists())
                self.assertIn("--no-config", argv)
                self.assertIn("--load-scripts=no", argv)
                self.assertIn("--script=/private/controls.lua", argv)
                listeners.append(self.bind(player.path, listening=True))
                return Mock(poll=Mock(return_value=None))
            player.ipc = Mock(return_value=True)
            try:
                with patch("aries_adapter.subprocess.Popen", side_effect=launch) as popen:
                    player.ensure()
                popen.assert_called_once()
                player.ipc.assert_called_once_with(["get_property", "idle-active"])
            finally:
                for conn in listeners:
                    conn.close()

    def test_ensure_reuses_live_socket_without_playback_changes(self):
        with tempfile.TemporaryDirectory() as directory:
            player = self.player(directory)
            with self.bind(player.path, listening=True):
                before = player.path.stat().st_ino
                player.ipc = Mock(return_value=False)
                with patch("aries_adapter.subprocess.Popen") as popen:
                    player.ensure()
                self.assertEqual(before, player.path.stat().st_ino)
                popen.assert_not_called()
                player.ipc.assert_called_once_with(["get_property", "idle-active"])

    def test_ensure_never_removes_socket_with_running_process_or_wrong_owner(self):
        with tempfile.TemporaryDirectory() as directory:
            player = self.player(directory)
            self.bind(player.path).close()
            player.process = Mock(poll=Mock(return_value=None))
            with self.assertRaises(SafeError):
                player.ensure()
            self.assertTrue(player.path.exists())
            player.process = None
            with patch("aries_adapter.os.getuid", return_value=os.getuid() + 1):
                with self.assertRaises(SafeError):
                    player.ensure()
            self.assertTrue(player.path.exists())

    def test_controls_dispatch_and_bounds(self):
        player = FakePlayer()
        player.status = Mock(return_value={"state": "paused", "muted": True, "fullscreen": True})
        for name, value, expected in (
                ("mute", None, ["cycle", "mute"]),
                ("fullscreen", None, ["cycle", "fullscreen"]),
                ("skip", -10, ["seek", -10, "relative+exact"]),
                ("skip", 10, ["seek", 10, "relative+exact"])):
            result = player.command(name, value)
            self.assertTrue(result["ok"])
            self.assertEqual(player.requests[-1], expected)
        count = len(player.requests)
        for name, value in (("skip", 0), ("skip", 11), ("skip", True), ("skip", float("nan")),
                            ("skip", "10"), ("fullscreen", True), ("mute", 1), ("volume", 101)):
            with self.assertRaises(SafeError):
                player.command(name, value)
        self.assertEqual(len(player.requests), count)

    def test_paused_session_status_reports_controls_without_mutation(self):
        with tempfile.TemporaryDirectory() as directory:
            player = self.player(directory)
            player.socket_state = Mock(return_value=("live", None))
            values = {"idle-active": False, "pause": True, "time-pos": 9.0, "duration": 8520,
                      "volume": 50, "mute": True, "fullscreen": True}
            player.ipc = Mock(side_effect=lambda command, optional=False: values[command[1]])
            player.prepare_embedding_for_play = Mock(side_effect=AssertionError("Reads/resume must not migrate"))
            result = player.status()
            self.assertEqual(result["state"], "paused")
            self.assertEqual(result["position"], 9.0)
            self.assertEqual(result["title"], "The Shawshank Redemption")
            self.assertTrue(result["muted"])
            self.assertTrue(result["fullscreen"])
            self.assertIsNone(result["last_error"])
            self.assertTrue(all(call.args[0][0] == "get_property" for call in player.ipc.call_args_list))
            player.command("resume")
            player.prepare_embedding_for_play.assert_not_called()
            changes = [call.args[0] for call in player.ipc.call_args_list if call.args[0][0] != "get_property"]
            self.assertEqual(changes, [["set_property", "pause", False]])


class PlayerEmbeddingHandoffTest(unittest.TestCase):
    """Mock IPC, process identity and launches; no player process is used."""

    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.player = Player(Path(self.directory.name) / "player.sock", Path(self.directory.name) / "command.json")
        self.player.command_file.write_text(json.dumps([sys.executable]))
        self.player.command_file.chmod(0o600)
        self.player.imdb_id, self.player.title = "tt0088846", "Brazil"
        self.info = SimpleNamespace(st_dev=7, st_ino=11)
        self.target = 12345
        self.player.embed_target = Mock(return_value=self.target)
        self.player.socket_state = Mock(return_value=("live", self.info))
        self.player.validate_socket = Mock(return_value=self.info)
        self.player.process_stamp = Mock(return_value=(os.getuid(), 123, "S"))
        actual_resolve = Path.resolve
        self.peer_exe = Path(sys.executable).resolve(strict=True)
        peer_path = Path("/proc") / str(os.getpid()) / "exe"
        def resolve(path, *args, **kwargs):
            if path == peer_path:
                return self.peer_exe
            return actual_resolve(path, *args, **kwargs)
        self.proc_patch = patch("aries_adapter.Path.resolve", new=resolve)
        self.proc_patch.start()
        self.addCleanup(self.proc_patch.stop)
        self.events = []
        self.player.ensure = Mock(side_effect=lambda: self.events.append("ensure"))
        self.player.ipc = Mock(side_effect=lambda command, optional=False: self.events.append(command))
        self.player.wait_for_player_exit = Mock(side_effect=lambda *args: self.events.append("exit-confirmed"))
        self.source = SimpleNamespace(imdb_id="tt0111161", title="The Shawshank Redemption",
                                      headers=[], url="https://example.invalid/synthetic-only.mkv")
        self.conn = MagicMock()
        self.conn.__enter__.return_value = self.conn
        self.conn.getsockopt.return_value = struct.pack("3i", os.getpid(), os.getuid(), os.getgid())
        self.conn.sendall.side_effect = lambda raw: self.events.append(json.loads(raw)["command"])
        self.wid = 0
        self.conn.makefile.side_effect = lambda mode: io.BytesIO(json.dumps(
            {"request_id": 42, "error": "success", "data": self.wid}).encode() + b"\n")
        self.socket_patch = patch("aries_adapter.socket.socket", return_value=self.conn)
        self.socket_patch.start()
        self.addCleanup(self.socket_patch.stop)
        self.random_patch = patch("aries_adapter.secrets.randbelow", return_value=42)
        self.random_patch.start()
        self.addCleanup(self.random_patch.stop)

    def test_new_play_waits_for_verified_peer_exit_before_ensure_and_load(self):
        result = self.player.play(self.source)
        self.assertEqual(self.events[:4], [["get_property", "wid"], ["quit"], "exit-confirmed", "ensure"])
        self.assertEqual(self.events[-1], ["loadfile", self.source.url, "replace"])
        self.assertEqual(result["state"], "loading")
        identity, info = self.player.wait_for_player_exit.call_args.args
        self.assertEqual(identity[0], os.getpid())
        self.assertGreater(identity[1], 0)
        self.assertIs(info, self.info)
        self.assertEqual(self.conn.getsockopt.call_count, 2)  # Rechecked before quit.
        self.assertEqual(self.player.validate_socket.call_count, 4)
        self.conn.connect.assert_called_once_with(str(self.player.path))

    def test_matching_embedded_player_is_reused_without_quit(self):
        self.wid = self.target
        self.player.play(self.source)
        self.assertNotIn(["quit"], self.events)
        self.player.wait_for_player_exit.assert_not_called()
        self.player.ensure.assert_called_once()
        self.assertEqual(self.events[-1], ["loadfile", self.source.url, "replace"])

    def test_no_native_target_does_not_probe_or_retire_player(self):
        self.player.embed_target.return_value = None
        self.player.play(self.source)
        self.conn.connect.assert_not_called()
        self.player.wait_for_player_exit.assert_not_called()
        self.player.ensure.assert_called_once()

    def test_unknown_peer_uid_or_executable_fails_before_state_changes(self):
        original = self.player.imdb_id, self.player.title
        self.conn.getsockopt.return_value = struct.pack("3i", os.getpid(), os.getuid() + 1, os.getgid())
        with self.assertRaises(SafeError):
            self.player.play(self.source)
        self.conn.getsockopt.return_value = struct.pack("3i", os.getpid(), os.getuid(), os.getgid())
        # A real, different executable fails the same exact identity check.
        self.player.command_file.write_text(json.dumps(["/bin/false"]))
        with self.assertRaises(SafeError):
            self.player.play(self.source)
        self.conn.sendall.assert_not_called()
        self.player.ensure.assert_not_called()
        self.player.ipc.assert_not_called()
        self.player.wait_for_player_exit.assert_not_called()
        self.assertEqual((self.player.imdb_id, self.player.title), original)

    def test_socket_replacement_or_parent_change_prevents_quit(self):
        replacement = SimpleNamespace(st_dev=7, st_ino=99)
        self.player.validate_socket.side_effect = [self.info, self.info, replacement]
        with self.assertRaises(SafeError):
            self.player.play(self.source)
        self.assertEqual(self.events, [["get_property", "wid"]])
        self.player.ensure.assert_not_called()
        self.player.ipc.assert_not_called()
        self.player.validate_socket.side_effect = None
        self.player.embed_target.side_effect = [self.target, self.target + 1]
        with self.assertRaises(SafeError):
            self.player.play(self.source)
        self.assertNotIn(["quit"], self.events)
        self.player.ensure.assert_not_called()

    def test_exit_failure_prevents_new_launch_or_load(self):
        self.player.wait_for_player_exit.side_effect = SafeError("player_unavailable", 503)
        with self.assertRaises(SafeError):
            self.player.play(self.source)
        self.assertEqual(self.events, [["get_property", "wid"], ["quit"]])
        self.player.ensure.assert_not_called()
        self.player.ipc.assert_not_called()

    def test_exit_wait_requires_process_exit_and_original_socket_to_be_dead(self):
        self.player.process_stamp = Mock(side_effect=FileNotFoundError)
        self.player.socket_state.return_value = ("dead", self.info)
        Player.wait_for_player_exit(self.player, (999999, 123), self.info)
        self.player.socket_state.return_value = ("live", self.info)
        with self.assertRaises(SafeError):
            Player.wait_for_player_exit(self.player, (999999, 123), self.info)
        self.player.socket_state.return_value = ("dead", SimpleNamespace(st_dev=7, st_ino=99))
        with self.assertRaises(SafeError):
            Player.wait_for_player_exit(self.player, (999999, 123), self.info)

    def test_exit_wait_times_out_for_same_live_process(self):
        self.player.process_stamp = Mock(return_value=(os.getuid(), 123, "S"))
        with patch("aries_adapter.time.monotonic", side_effect=[0, 0, 5]), patch("aries_adapter.time.sleep"):
            with self.assertRaises(SafeError):
                Player.wait_for_player_exit(self.player, (999999, 123), self.info)
        self.player.socket_state.assert_not_called()


if __name__ == "__main__":
    unittest.main()

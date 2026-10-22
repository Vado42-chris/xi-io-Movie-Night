"""Offline settings tests. No real accounts, network, player or Nuvio writes."""

import copy
import io
import json
import os
import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import app_settings
import concierge
from player import aries_adapter


class SettingsFixture(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.store = self.directory / "runtime" / "app-settings.json"
        patcher = patch.object(app_settings, "STORE", self.store)
        patcher.start()
        self.addCleanup(patcher.stop)

    def save(self, section, key, value):
        document = app_settings.read_document()
        document["settings"][section][key] = value
        return app_settings.update_document(document, model_validator=lambda _: True)

    def handler(self, route="/api/settings", method="GET", payload=None):
        raw = b"" if payload is None else json.dumps(payload).encode()
        return SimpleNamespace(
            path=route, command=method,
            server=SimpleNamespace(server_port=8789, player_port=18879, player_token="SYNTHETIC_ADAPTER_TOKEN"),
            headers={"Host": "localhost:8789", "X-Movie-Night": "1", "Content-Type": "application/json", "Content-Length": str(len(raw))},
            connection=Mock(), rfile=io.BytesIO(raw), json_response=Mock())


class PersistenceTest(SettingsFixture):
    def test_defaults_are_read_only_and_changes_are_private_and_live(self):
        self.assertEqual(app_settings.read_document(), {"revision": 0, "settings": app_settings.DEFAULTS})
        self.assertFalse(self.store.parent.exists())
        document = self.save("appearance", "opacity", 77)
        self.assertEqual(document["revision"], 1)
        self.assertEqual(self.store.parent.stat().st_mode & 0o777, 0o700)
        self.assertEqual(self.store.stat().st_mode & 0o777, 0o600)
        self.assertEqual(app_settings.read_settings()["appearance"]["opacity"], 77)
        self.assertEqual(json.loads(self.store.read_text())["schema"], app_settings.SCHEMA)
        document["settings"]["appearance"]["opacity"] = 90
        self.assertEqual(app_settings.read_settings()["appearance"]["opacity"], 77)
        self.assertEqual(app_settings.update_document(app_settings.read_document())["revision"], 1)

    def test_schema_rejects_unknown_keys_wrong_types_and_unbounded_values(self):
        cases = [("appearance", "opacity", True), ("appearance", "opacity", 96),
                 ("appearance", "mode", "window-opacity"), ("browsing", "catalog", "arbitrary"),
                 ("browsing", "show_ratings", 1), ("browsing", "start_view", "https://example.invalid"),
                 ("playback", "preferred_quality", "auto"), ("playback", "seek_seconds", 11),
                 ("playback", "default_volume", -1), ("plugins", "torrentio_enabled", "true"),
                 ("concierge", "model", "http://SECRET@example.invalid/model"),
                 ("concierge", "model", "x" * 161)]
        for section, key, value in cases:
            with self.subTest(section=section, key=key, value=value):
                document = app_settings.read_document()
                document["settings"][section][key] = value
                with self.assertRaises(app_settings.SettingsError) as caught:
                    app_settings.update_document(document)
                self.assertEqual(caught.exception.code, "invalid_settings")
        document = app_settings.read_document()
        document["settings"]["plugins"]["api_key"] = "SECRET"
        with self.assertRaises(app_settings.SettingsError):
            app_settings.update_document(document)
        self.assertFalse(self.store.exists())

    def test_model_change_requires_installed_tag_without_blocking_other_saves(self):
        document = app_settings.read_document()
        document["settings"]["concierge"]["model"] = "example/model:latest"
        with self.assertRaises(app_settings.SettingsError) as caught:
            app_settings.update_document(document, model_validator=lambda _: False)
        self.assertEqual(caught.exception.code, "model_not_installed")
        self.assertFalse(self.store.exists())
        validator = Mock(return_value=True)
        self.assertEqual(app_settings.update_document(document, validator)["settings"]["concierge"]["model"], "example/model:latest")
        validator.assert_called_once_with("example/model:latest")
        document = app_settings.read_document()
        document["settings"]["appearance"]["mode"] = "solid"
        validator.reset_mock()
        app_settings.update_document(document, validator)
        validator.assert_not_called()

    def test_concurrent_revision_conflict_preserves_the_winning_document(self):
        original = app_settings.read_document()
        outcomes = []
        barrier = threading.Barrier(2)
        def save(opacity):
            payload = copy.deepcopy(original)
            payload["settings"]["appearance"]["opacity"] = opacity
            barrier.wait(timeout=3)
            try:
                outcomes.append(app_settings.update_document(payload))
            except app_settings.SettingsError as error:
                outcomes.append(error.code)
        workers = [threading.Thread(target=save, args=(value,)) for value in (70, 80)]
        for worker in workers:
            worker.start()
        for worker in workers:
            worker.join(timeout=5)
            self.assertFalse(worker.is_alive())
        self.assertEqual(outcomes.count("revision_conflict"), 1)
        winner = next(value for value in outcomes if isinstance(value, dict))
        self.assertEqual(app_settings.read_document(), winner)
        self.assertEqual(winner["revision"], 1)

    def test_corrupt_insecure_or_symlink_settings_are_not_overwritten(self):
        self.save("appearance", "opacity", 71)
        self.store.write_text('{"SECRET":')
        with self.assertRaises(app_settings.SettingsError) as caught:
            app_settings.read_document()
        self.assertNotIn("SECRET", str(caught.exception))
        self.assertNotIn(str(self.store), str(caught.exception))
        before = self.store.read_bytes()
        with self.assertRaises(app_settings.SettingsError):
            app_settings.update_document({"revision": 0, "settings": app_settings.DEFAULTS})
        self.assertEqual(self.store.read_bytes(), before)
        self.store.unlink()
        target = self.directory / "do-not-touch.json"
        target.write_text("PRIVATE_PLACEHOLDER")
        self.store.symlink_to(target)
        with self.assertRaises(app_settings.SettingsError):
            app_settings.read_document()
        self.assertEqual(target.read_text(), "PRIVATE_PLACEHOLDER")
        self.store.unlink()
        self.store.write_text("{}")
        self.store.chmod(0o644)
        with self.assertRaises(app_settings.SettingsError):
            app_settings.read_document()

    def test_http_guards_and_duplicate_json_reject_without_writes(self):
        handler = self.handler(method="POST", payload=app_settings.read_document())
        handler.headers["Origin"] = "https://external.invalid"
        app_settings.handle(handler)
        self.assertEqual(handler.json_response.call_args.args[0], 403)
        handler = self.handler(method="POST", payload=app_settings.read_document())
        raw = b'{"revision":0,"revision":1,"settings":{}}'
        handler.headers["Content-Length"] = str(len(raw))
        handler.rfile = io.BytesIO(raw)
        app_settings.handle(handler)
        self.assertEqual(handler.json_response.call_args.args[0], 400)
        self.assertFalse(self.store.exists())
        with patch.object(app_settings, "plugin_status") as status:
            handler = self.handler()
            self.assertTrue(app_settings.handle(handler))
            self.assertEqual(handler.json_response.call_args.args, (200, app_settings.read_document()))
            status.assert_not_called()


class ProviderSettingsTest(SettingsFixture):
    def resolver(self):
        manifest = "https://torrentio.strem.fun/realdebrid=SYNTHETIC_PROVIDER_SECRET/manifest.json"
        self.props = self.directory / "addons.properties"
        self.original = "installed_addon_urls_1=" + json.dumps([manifest]) + "\naddon_enabled_states_1=" + json.dumps({manifest: True}) + "\n"
        self.props.write_text(self.original)
        resolver = aries_adapter.Resolver(self.props)
        resolver.fetch = Mock(return_value=[
            {"name": "[RD+] Torrentio 1080p", "title": "12 GB", "url": "https://cdn.example.com/SYNTHETIC_MEDIA_SECRET/large"},
            {"name": "[RD+] Torrentio 2160p", "title": "8 GB", "url": "https://cdn.example.com/SYNTHETIC_MEDIA_SECRET/4k"},
            {"name": "[RD+] Torrentio 1080p", "title": "1.5 GB", "url": "https://cdn.example.com/SYNTHETIC_MEDIA_SECRET/small"},
            {"name": "[RD+] Torrentio 720p", "behaviorHints": {"videoSize": 500000000}, "url": "https://cdn.example.com/SYNTHETIC_MEDIA_SECRET/720"},
            {"name": "[RD download] 1080p", "title": "0.1 GB", "url": "https://cdn.example.com/uncached"},
        ])
        return resolver

    def test_quality_and_smaller_encode_preferences_change_order_and_expire_old_choices(self):
        resolver = self.resolver()
        sources = resolver.sources("tt0088763", "Back to the Future")
        self.assertTrue(sources[0].url.endswith("/small"))
        self.assertEqual([source.quality for source in sources], ["1080p", "1080p", "720p", "2160p"])
        self.assertIs(resolver.get(sources[0].id, "tt0088763"), sources[0])
        self.save("playback", "preferred_quality", "2160p")
        with self.assertRaises(aries_adapter.SafeError) as caught:
            resolver.get(sources[0].id, "tt0088763")
        self.assertEqual(caught.exception.code, "source_expired")
        self.assertEqual(resolver.sources("tt0088763", "Back to the Future")[0].quality, "2160p")
        self.save("playback", "preferred_quality", "1080p")
        self.save("playback", "prefer_small_encodes", False)
        self.assertTrue(resolver.sources("tt0088763", "Back to the Future")[0].url.endswith("/large"))
        self.save("playback", "preferred_quality", "720p")
        self.assertEqual(resolver.sources("tt0088763", "Back to the Future")[0].quality, "720p")
        self.assertEqual(self.props.read_text(), self.original)

    def test_disabled_provider_blocks_search_and_prior_ids_without_harming_controls(self):
        resolver = self.resolver()
        source = resolver.sources("tt0088763", "Back to the Future")[0]
        self.save("plugins", "torrentio_enabled", False)
        resolver.fetch.reset_mock()
        for action in (lambda: resolver.sources("tt0088763", "Back to the Future"), lambda: resolver.get(source.id, "tt0088763")):
            with self.assertRaises(aries_adapter.SafeError) as caught:
                action()
            self.assertEqual(caught.exception.code, "plugin_disabled")
        resolver.fetch.assert_not_called()
        player = aries_adapter.Player(self.directory / "player.sock", self.directory / "command.json")
        player.ipc = Mock()
        player.status = Mock(return_value={"state": "playing"})
        self.assertTrue(player.command("resume")["ok"])
        player.ipc.assert_called_once_with(["set_property", "pause", False])
        self.assertEqual(self.props.read_text(), self.original)

    def test_settings_changed_during_fetch_invalidate_the_response(self):
        resolver = self.resolver()
        streams = resolver.fetch.return_value
        resolver.fetch.side_effect = lambda _: (self.save("playback", "preferred_quality", "720p"), streams)[1]
        with self.assertRaises(aries_adapter.SafeError) as caught:
            resolver.sources("tt0088763", "Back to the Future")
        self.assertEqual(caught.exception.code, "source_expired")
        self.assertEqual(resolver.cache, {})

    def test_private_plugin_status_and_public_adapter_proxy_do_not_leak_secrets(self):
        resolver = self.resolver()
        status = resolver.plugin_status()
        self.assertEqual(status, {"torrentio": {"configured": True, "status": "configured"}})
        resolver.fetch.assert_not_called()
        raw = json.dumps({**status, "manifest": "https://SECRET", "token": "SYNTHETIC_ADAPTER_TOKEN"}).encode()
        opener = Mock()
        opener.open.return_value = io.BytesIO(raw)
        handler = self.handler("/api/settings/plugins")
        with patch.object(app_settings, "build_opener", return_value=opener), patch.object(concierge, "installed_models", return_value=["llama3.1:8b"]):
            result = app_settings.plugin_status(handler.server)
        public = json.dumps(result)
        for forbidden in ("SECRET", "https://", "Authorization", "SYNTHETIC_ADAPTER_TOKEN"):
            self.assertNotIn(forbidden, public)
        request = opener.open.call_args.args[0]
        self.assertEqual(request.full_url, "http://127.0.0.1:18879/plugins")
        self.assertEqual(request.get_header("Authorization"), "Bearer SYNTHETIC_ADAPTER_TOKEN")
        self.assertFalse(result["plugins"][0]["connection_checked"])
        self.assertEqual(result["models"], ["llama3.1:8b"])
        self.assertEqual(self.props.read_text(), self.original)

    def test_volume_only_applies_to_new_play_and_seek_intervals_are_bounded(self):
        player = aries_adapter.Player(self.directory / "player.sock", self.directory / "command.json")
        player.prepare_embedding_for_play = Mock()
        player.ensure = Mock()
        player.ipc = Mock()
        player.status = Mock(return_value={"state": "playing"})
        self.save("playback", "default_volume", 35)
        player.ipc.assert_not_called()
        source = SimpleNamespace(imdb_id="tt0088763", title="Back to the Future", headers=[], url="https://example.invalid/synthetic")
        player.play(source)
        commands = [call.args[0] for call in player.ipc.call_args_list]
        self.assertIn(["set_property", "volume", 35], commands)
        self.assertEqual(commands[-1], ["loadfile", source.url, "replace"])
        player.ipc.reset_mock()
        self.save("playback", "default_volume", 20)
        player.command("resume")
        player.ipc.assert_called_once_with(["set_property", "pause", False])
        for value in (-30, -10, -5, 5, 10, 30):
            player.command("skip", value)
            self.assertEqual(player.ipc.call_args.args[0], ["seek", value, "relative+exact"])
        for value in (True, 0, 11, 31):
            with self.assertRaises(aries_adapter.SafeError):
                player.command("skip", value)


class ConciergeAndCatalogueTest(SettingsFixture):
    def test_cinemeta_gate_blocks_network_routes_but_keeps_local_directory(self):
        self.save("plugins", "cinemeta_enabled", False)
        for route in ("/api/browse?type=movie", "/api/browse/meta?id=tt0088763"):
            handler = self.handler(route)
            self.assertTrue(app_settings.gate_catalogue(handler))
            self.assertEqual(handler.json_response.call_args.args[0], 503)
        self.assertFalse(app_settings.gate_catalogue(self.handler("/api/catalogues")))
        self.save("plugins", "cinemeta_enabled", True)
        handler = self.handler("/api/browse?type=movie")
        self.assertFalse(app_settings.gate_catalogue(handler))
        handler.json_response.assert_not_called()

    def test_disabled_concierge_never_calls_ollama(self):
        self.save("plugins", "ollama_enabled", False)
        with patch.object(concierge, "_ollama") as ollama:
            self.assertFalse(concierge.status()["available"])
            with self.assertRaises(concierge.ConciergeError) as caught:
                concierge.chat({"messages": [{"role": "user", "content": "Suggest a movie"}]})
            self.assertEqual(caught.exception.status, 503)
            ollama.assert_not_called()

    def test_selected_model_is_used_for_status_inference_and_returned_proposal(self):
        self.save("concierge", "model", "example/model:latest")
        def ollama(path, payload=None, timeout=4):
            if path == "/api/tags":
                return {"models": [{"name": "example/model:latest"}, {"name": "https://SYNTHETIC_SECRET"}]}
            self.assertEqual(path, "/api/chat")
            self.assertEqual(payload["model"], "example/model:latest")
            return {"message": {"content": json.dumps({"message": "Pick a genre and I can suggest a list.", "collection": None})}}
        with patch.object(concierge, "_ollama", side_effect=ollama):
            self.assertEqual(concierge.status()["models"], ["example/model:latest"])
            result = concierge.chat({"messages": [{"role": "user", "content": "Suggest a movie"}]})
        self.assertEqual(result["model"], "example/model:latest")
        self.assertNotIn("SECRET", json.dumps(result))


if __name__ == "__main__":
    unittest.main()

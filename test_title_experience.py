"""Offline title/source acceptance tests. No provider accounts or real playback."""
import json
import unittest
from unittest.mock import Mock, patch
import catalogue_browse
from player.aries_adapter import Adapter, SafeError, Source, technical_metadata

class TitleExperienceTest(unittest.TestCase):
    def test_detail_enrichment_is_allowlisted(self):
        raw = {"id": "tt0088763", "name": "Example film", "type": "movie", "year": 1985,
               "background": "https://images.metahub.space/background/tt0088763/img", "cast": ["Actor", "Actor", {"bad": "data"}],
               "director": ["Director"], "writer": "Writer", "country": "Country", "awards": "Award",
               "url": "https://example.com/PRIVATE", "behaviorHints": {"Authorization": "PRIVATE"},
               "logo": "http://127.0.0.1/private", "trailers": [{"url": "PRIVATE"}]}
        with patch.object(catalogue_browse, "_cached", side_effect=lambda path, convert: convert({"meta": raw})):
            result = catalogue_browse.meta({"type": "movie", "id": "tt0088763"})
        self.assertEqual(result["movie"]["cast"], ["Actor"])
        self.assertEqual(result["movie"]["writer"], ["Writer"])
        self.assertEqual(result["movie"]["logo"], "")
        self.assertNotIn("PRIVATE", json.dumps(result))
        self.assertEqual(result["movie"]["metadata_source"], "Cinemeta")

    def test_source_hints_never_echo_raw_provider_text(self):
        hints = technical_metadata({"behaviorHints": {"videoSize": 2147483648}},
            "2160p HEVC Dolby.Vision Atmos 7.1 https://example.com/PRIVATE_TOKEN realdebrid=PRIVATE_SECRET")
        self.assertEqual(hints["video_codec"], "HEVC / H.265")
        self.assertEqual(hints["dynamic_range"], "Dolby Vision")
        self.assertEqual(hints["size_bytes"], 2147483648)
        self.assertIn("Dolby Atmos", hints["audio"])
        source = Source("a" * 32, "tt0088763", "Film", "2160p", "4K", 1000, "digest", "PRIVATE_URL", ["PRIVATE_HEADER"], hints)
        self.assertNotIn("PRIVATE", json.dumps(source.public()))
        self.assertNotIn("https://", json.dumps(source.public()))

    def test_description_and_filename_supply_safe_stream_details(self):
        stream = {"name": "[RD+] 1080p", "description": "Example.S01E02.WEB-DL.x265.English 1.45 GB",
                  "behaviorHints": {"filename": "Example.S01E02.DDP.5.1.mkv"}}
        hints = technical_metadata(stream, "")
        self.assertEqual(hints["video_codec"], "HEVC / H.265")
        self.assertEqual(hints["source_format"], "WEB-DL")
        self.assertEqual(hints["container"], "MKV")
        self.assertEqual(hints["languages"], ["English"])
        self.assertIn("DD+", hints["audio"])
        self.assertEqual(hints["size_bytes"], int(1.45 * 1024 ** 3))
        self.assertNotIn("Example", json.dumps(hints))

    def test_provider_descriptions_never_export_addresses_or_secrets(self):
        raw = {"description": "https://example.com/PRIVATE_KEY French WEB-DL x264",
               "behaviorHints": {"filename": "PRIVATE_NAME.mp4", "proxyHeaders": {"request": {"Authorization": "PRIVATE_TOKEN"}}}}
        result = technical_metadata(raw, "")
        self.assertNotIn("PRIVATE", json.dumps(result))
        self.assertNotIn("https://", json.dumps(result))
        self.assertEqual(result["languages"], ["French"])

    def test_unknown_hints_remain_unknown(self):
        hints = technical_metadata({}, "plain release")
        self.assertIsNone(hints["size_bytes"])
        self.assertEqual(hints["dynamic_range"], "")
        self.assertEqual(hints["audio"], [])

    def test_play_without_selection_is_rejected_before_resolving(self):
        resolver, player = Mock(), Mock()
        with self.assertRaises(SafeError) as caught:
            Adapter(resolver, player).post("/play", {"imdb_id": "tt0088763", "title": "Film"})
        self.assertEqual(caught.exception.code, "source_required")
        resolver.sources.assert_not_called()
        player.play.assert_not_called()

    def test_selected_source_binds_movie_before_play(self):
        resolver, player = Mock(), Mock()
        player.play.return_value = {"state": "loading"}
        code, _ = Adapter(resolver, player).post("/play", {"imdb_id": "tt0088763", "title": "Film", "source_id": "a"*32})
        self.assertEqual(code, 202)
        resolver.get.assert_called_once_with("a"*32, "tt0088763")
        player.play.assert_called_once_with(resolver.get.return_value)

if __name__ == "__main__": unittest.main()

"""No providers, playback or private file mutations in these context contract tests."""
import unittest
from unittest.mock import patch
import concierge

class SelectionContextTest(unittest.TestCase):
    def setUp(self):
        self.movies = {"tt0088763": {"imdb_id": "tt0088763", "title": "Back to the Future", "year": 1985, "genres": ["Adventure"]}}
    def test_context_absent_preserves_existing_catalogue(self):
        self.assertIs(concierge._selection_catalogue(None, self.movies), self.movies)
    def test_context_resolves_only_requested_known_titles(self):
        with patch.object(concierge.personal_library, "known_titles", return_value=[]):
            result = concierge._selection_catalogue({"ids": ["movie:tt0088763"], "selected": "movie:tt0088763"}, self.movies)
        self.assertEqual(list(result), ["tt0088763"])
    def test_empty_selection_does_not_fall_back_to_everything(self):
        with patch.object(concierge.personal_library, "known_titles", return_value=[]):
            self.assertEqual(concierge._selection_catalogue({"ids": [], "selected": None}, self.movies), {})
    def test_unknown_title_is_not_trusted_client_metadata(self):
        with patch.object(concierge.personal_library, "known_titles", return_value=[]):
            with self.assertRaises(concierge.ConciergeError) as caught:
                concierge._selection_catalogue({"ids": ["movie:tt9999999"]}, self.movies)
        self.assertEqual(caught.exception.status, 409)
    def test_normalized_library_does_not_erase_curated_year_or_runtime(self):
        self.movies["tt0088763"]["runtime"] = "116 min"
        row = {"imdbId": "tt0088763", "title": "Back to the Future", "releaseInfo": "1985", "type": "movie"}
        with patch.object(concierge.personal_library, "known_titles", return_value=[row]):
            result = concierge._selection_catalogue({"ids": ["movie:tt0088763"]}, self.movies)
        self.assertEqual(result["tt0088763"]["year"], 1985)
        self.assertEqual(result["tt0088763"]["runtime"], "116 min")
    def test_wrong_selected_title_fails(self):
        with self.assertRaises(concierge.ConciergeError):
            concierge._selection_catalogue({"ids": ["movie:tt0088763"], "selected": "movie:tt9999999"}, self.movies)
    def test_unknown_context_field_fails(self):
        with self.assertRaises(concierge.ConciergeError):
            concierge._selection_catalogue({"ids": [], "url": "http://localhost/private"}, self.movies)
    def test_series_is_resolved_from_existing_library_metadata(self):
        row = {"imdbId": "tt0944947", "title": "Example series", "year": 2011, "type": "series", "genres": ["Drama"]}
        with patch.object(concierge.personal_library, "known_titles", return_value=[row]):
            result = concierge._selection_catalogue({"ids": ["series:tt0944947"]}, self.movies)
        self.assertEqual(result["tt0944947"]["type"], "series")
        self.assertEqual(result["tt0944947"]["title"], row["title"])
if __name__ == "__main__": unittest.main()

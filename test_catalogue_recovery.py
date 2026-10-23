"""Exact-cache discovery recovery. Synthetic metadata only; no provider access."""
import copy
import unittest
from unittest.mock import patch
import catalogue_browse as c

class CatalogueRecoveryTests(unittest.TestCase):
    def setUp(self):
        c._cache.clear()
        self.params = {'type':'movie','catalog':'top','search':'arbitrary title','skip':'0'}
        self.raw = {'metas':[{'id':'tt8400222','type':'movie','name':'Arbitrary title','poster':'https://images.example.test/art.jpg'}]}
        with patch.object(c.time,'monotonic',return_value=100), patch.object(c,'_fetch_document',return_value=self.raw):
            self.first=c.browse(self.params)
        self.path=next(iter(c._cache))
    def tearDown(self):
        c._cache.clear()
    def stale(self,when=401,status=504,params=None):
        with patch.object(c.time,'monotonic',return_value=when),patch.object(c,'_fetch_document',side_effect=c.CatalogueError(status,'provider unavailable')):
            return c.browse(params or self.params)
    def test_expired_success_survives_transient_outage_with_explicit_freshness(self):
        result=self.stale()
        self.assertEqual(result['movies'],self.first['movies'])
        self.assertTrue(result['stale']);self.assertEqual(result['freshness'],'stale')
        self.assertIn('cached',result['warning'].lower())
    def test_transient_service_errors_use_same_query_only(self):
        for code in [502,503,504]:
            self.assertTrue(self.stale(status=code)['stale'])
    def test_cached_result_is_a_copy(self):
        result=self.stale();result['movies'].clear()
        self.assertEqual(len(self.stale()['movies']),1)
    def test_stale_use_does_not_refresh_expiry(self):
        expiry=c._cache[self.path][0]
        self.stale();self.stale(when=800)
        self.assertEqual(c._cache[self.path][0],expiry)
    def test_excessively_old_cache_is_not_used(self):
        with self.assertRaises(c.CatalogueError):self.stale(when=5000)
    def test_other_search_has_no_fallback(self):
        with self.assertRaises(c.CatalogueError):self.stale(params={**self.params,'search':'different'})
    def test_other_offset_has_no_fallback(self):
        with self.assertRaises(c.CatalogueError):self.stale(params={**self.params,'skip':'100'})
    def test_other_media_type_has_no_fallback(self):
        with self.assertRaises(c.CatalogueError):self.stale(params={**self.params,'type':'series'})
    def test_auth_denial_is_never_represented_as_cached_success(self):
        with self.assertRaises(c.CatalogueError):self.stale(status=403)
    def test_empty_cache_cannot_turn_outage_into_no_matches(self):
        c._cache[self.path]=(400,{**self.first,'movies':[]})
        with self.assertRaises(c.CatalogueError):self.stale()
    def test_live_recovery_replaces_cached_snapshot_and_removes_stale_status(self):
        self.stale()
        raw={'metas':[{'id':'tt8400223','type':'movie','name':'Recovered title'}]}
        with patch.object(c.time,'monotonic',return_value=500),patch.object(c,'_fetch_document',return_value=raw):
            result=c.browse(self.params)
        self.assertNotIn('stale',result);self.assertEqual(result['movies'][0]['imdb_id'],'tt8400223')
    def test_metadata_readback_does_not_gain_stale_fallback(self):
        path='/meta/movie/tt8400222.json';c._cache[path]=(400,{'movie':self.first['movies'][0]})
        with patch.object(c.time,'monotonic',return_value=401),patch.object(c,'_fetch_document',side_effect=c.CatalogueError(504,'timeout')):
            with self.assertRaises(c.CatalogueError):c.meta({'id':'tt8400222','type':'movie'})

if __name__=='__main__':unittest.main()

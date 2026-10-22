"""Offline episode identity tests. No real accounts, provider traffic or media."""
import copy
import json
import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch
import app_settings
import catalogue_browse as catalogue
import personal_library as library
import player_gateway as gateway
from player.aries_adapter import Adapter, Player, Resolver, SafeError, media_input
import test_settings as support

SERIES = 'tt0407362'
def target(season=1, episode=1):
    return {'imdb_id': SERIES, 'title': 'Test series', 'type': 'series', 'season': season, 'episode': episode}

class MetadataTest(unittest.TestCase):
    def test_episode_allowlist_specials_order_and_duplicates(self):
        def episode(s,e,**extra):
            return {'id':f'{SERIES}:{s}:{e}','season':s,'episode':e,'title':f'Episode {e}',**extra}
        rows=[episode(2,1),episode(0,1),episode(1,2),episode(1,1,streams=[{'url':'PRIVATE'}],thumbnail='http://127.0.0.1/private'),episode(1,1)]
        result=catalogue.episode_records(rows,SERIES)
        self.assertEqual([(r['season'],r['episode']) for r in result],[(0,1),(1,1),(1,2),(2,1)])
        self.assertNotIn('PRIVATE',json.dumps(result));self.assertEqual(result[1]['thumbnail'],'')
    def test_mismatched_or_invalid_episode_identity_is_rejected(self):
        for s,e,i in [(True,1,f'{SERIES}:1:1'),(1,0,f'{SERIES}:1:0'),(-1,1,f'{SERIES}:-1:1'),(1,2,f'{SERIES}:1:1'),(1,1,'tt9999999:1:1')]:
            self.assertEqual(catalogue.episode_records([{'id':i,'season':s,'episode':e}],SERIES),[])
    def test_meta_exposes_episode_records_only_for_series(self):
        raw={'id':SERIES,'type':'series','name':'Test','videos':[{'id':SERIES+':1:1','season':1,'episode':1,'title':'Pilot'}]}
        with patch.object(catalogue,'_cached',side_effect=lambda _,convert:convert({'meta':raw})):
            self.assertEqual(catalogue.meta({'id':SERIES,'type':'series'})['movie']['episodes'][0]['id'],SERIES+':1:1')

class EpisodeTest(support.SettingsFixture):
    def resolver(self):
        manifest='https://torrentio.strem.fun/realdebrid=SYNTHETIC_SECRET/manifest.json'
        props=self.directory/'addons.properties';self.original='installed_addon_urls_1='+json.dumps([manifest])+'\naddon_enabled_states_1='+json.dumps({manifest:True})+'\n';props.write_text(self.original)
        resolver=Resolver(props)
        resolver.fetch=Mock(return_value=[{'name':'[RD+] Torrentio 1080p','url':'https://cdn.example.com/SYNTHETIC_MEDIA'}])
        self.props=props;return resolver
    def test_series_endpoint_and_cache_are_episode_specific(self):
        resolver=self.resolver();a=resolver.sources(SERIES,'Test','series',1,1)[0]
        self.assertTrue(resolver.fetch.call_args.args[0].endswith('/stream/series/'+SERIES+':1:1.json'))
        self.assertEqual(resolver.sources(SERIES,'Test','series',1,1)[0].id,a.id)
        self.assertEqual(resolver.fetch.call_count,1)
        b=resolver.sources(SERIES,'Test','series',1,2)[0]
        self.assertNotEqual(a.id,b.id)
        for kind,s,e in [('series',1,2),('series',2,1),('movie',None,None)]:
            with self.assertRaises(SafeError):resolver.get(a.id,SERIES,kind,s,e)
        self.assertIs(resolver.get(a.id,SERIES,'series',1,1),a)
        self.assertEqual(self.props.read_text(),self.original)
    def test_specials_and_movie_paths_are_distinct(self):
        resolver=self.resolver();resolver.sources(SERIES,'Special','series',0,1)
        self.assertTrue(resolver.fetch.call_args.args[0].endswith(f'/stream/series/{SERIES}:0:1.json'))
        resolver.sources(SERIES,'Film')
        self.assertTrue(resolver.fetch.call_args.args[0].endswith(f'/stream/movie/{SERIES}.json'))
    def test_invalid_episode_never_fetches_or_plays(self):
        resolver=self.resolver();player=Mock();adapter=Adapter(resolver,player)
        cases=[{**target(),'episode':None},{**target(),'season':True},{**target(),'episode':0},{**target(),'type':'movie'},{**target(),'url':'SECRET'}]
        for payload in cases:
            with self.assertRaises(SafeError):adapter.post('/sources',payload)
        resolver.fetch.assert_not_called();player.play.assert_not_called()
    def test_adapter_requires_exact_source_before_play(self):
        resolver=self.resolver();player=Mock();adapter=Adapter(resolver,player)
        code,data=adapter.post('/sources',target());self.assertEqual(code,200)
        self.assertEqual(data['video_id'],SERIES+':1:1');self.assertNotIn('SECRET',json.dumps(data))
        with self.assertRaises(SafeError):adapter.post('/play',target())
        with self.assertRaises(SafeError):adapter.post('/play',{**target(1,2),'source_id':data['sources'][0]['id']})
        player.play.assert_not_called()
        adapter.post('/play',{**target(),'source_id':data['sources'][0]['id']})
        self.assertEqual(player.play.call_args.args[0].video_id,SERIES+':1:1')
    def test_settings_change_invalidates_episode_source(self):
        resolver=self.resolver();source=resolver.sources(SERIES,'Test','series',1,1)[0]
        self.save('playback','preferred_quality','720p')
        with self.assertRaises(SafeError):resolver.get(source.id,SERIES,'series',1,1)
    def test_selected_resume_is_guarded_against_different_episode(self):
        player=Player(self.directory/'player.sock',self.directory/'command.json');player.imdb_id=SERIES;player.media_type='series';player.season=1;player.episode=1;player.command=Mock(return_value={'ok':True})
        adapter=Adapter(Mock(),player)
        with self.assertRaises(SafeError):adapter.post('/command',{'command':'resume',**{k:v for k,v in target(1,2).items() if k!='title'}})
        player.command.assert_not_called()
        adapter.post('/command',{'command':'resume',**{k:v for k,v in target().items() if k!='title'}})
        player.command.assert_called_once_with('resume',None)
    def test_player_resume_options_and_selection_roundtrip(self):
        source=self.resolver().sources(SERIES,'Test','series',0,2)[0]
        player=Player(self.directory/'player.sock',self.directory/'command.json',self.directory/'selection.json')
        player.prepare_embedding_for_play=Mock();player.ensure=Mock();player.ipc=Mock()
        result=player.play(source,123.25)
        self.assertEqual(player.ipc.call_args.args[0],['loadfile',source.url,'replace','start=123.25'])
        self.assertEqual(result['video_id'],SERIES+':0:2')
        restored=Player(player.path,player.command_file,player.selection_file)
        self.assertEqual(restored.snapshot()['video_id'],SERIES+':0:2')
        player.play(source)
        self.assertEqual(player.ipc.call_args.args[0],['loadfile',source.url,'replace'])
        self.assertNotIn('SYNTHETIC',player.selection_file.read_text())
    def test_invalid_resume_offset_never_plays(self):
        resolver=self.resolver();adapter=Adapter(resolver,Mock());_,result=adapter.post('/sources',target())
        for value in [True,-1,float('inf'),90000,'2']:
            with self.assertRaises(SafeError):adapter.post('/play',{**target(),'source_id':result['sources'][0]['id'],'start_seconds':value})
        adapter.player.play.assert_not_called()

class HistoryTest(support.SettingsFixture):
    def setUp(self):
        super().setUp();self.library_store=self.directory/'private/personal-library.json'
        patcher=patch.object(library,'STORE',self.library_store);patcher.start();self.addCleanup(patcher.stop)
        state=library._empty();state['imported']['library']=[{'id':SERIES,'type':'series','title':'Test series'}];library._write(state)
    def test_episode_progress_has_separate_existing_keys(self):
        library.record_progress(SERIES,'series',120000,2400000,False,1,1)
        library.record_progress(SERIES,'series',330000,2400000,False,1,2)
        self.assertEqual(library.resume_position(SERIES,'series',1,1),120)
        self.assertEqual(library.resume_position(SERIES,'series',1,2),330)
        self.assertEqual(library.resume_position(SERIES,'series',2,1),0)
        state=library._read();self.assertEqual(set(state['local_history']),{f'series|{SERIES}:1:1',f'series|{SERIES}:1:2'})
        self.assertEqual(state['version'],1)
    def test_completed_episode_is_not_resumed(self):
        library.record_progress(SERIES,'series',2300000,2400000,True,0,1)
        self.assertEqual(library.resume_position(SERIES,'series',0,1),0)
    def test_only_observed_active_progress_is_written_and_throttled(self):
        server=SimpleNamespace(progress_lock=threading.RLock(),progress_seen={})
        result={**target(),'state':'playing','position':100,'duration':2400}
        gateway._observe_progress(server,result);self.assertEqual(library.resume_position(SERIES,'series',1,1),100)
        gateway._observe_progress(server,{**result,'position':120});self.assertEqual(library.resume_position(SERIES,'series',1,1),100)
        gateway._observe_progress(server,{**result,'position':120},force=True);self.assertEqual(library.resume_position(SERIES,'series',1,1),120)
        before=self.library_store.read_bytes();gateway._observe_progress(server,{**result,'state':'idle','position':130},force=True);self.assertEqual(before,self.library_store.read_bytes())

if __name__=='__main__':unittest.main()

"""Track-list truth test; never starts media, network or a native window."""
import os,sys,tempfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'player'))
import unittest
from aries_adapter import Player

class TrackReadbackTest(unittest.TestCase):
    def make_player(self, directory, tracks):
        player=Player(Path(directory)/'never-opened.sock',Path(directory)/'not-used.json')
        player.imdb_id='tt0111161'; player.title='Source specimen'
        player.has_played=True; player.stop_requested=False
        player.socket_state=lambda:('live',None)
        player.process_running=lambda:False
        def ipc(cmd,optional=False):
            self.assertEqual(cmd[0],'get_property')
            return {'idle-active':False,'pause':False,
                    'track-list':tracks,'time-pos':15,'duration':120,
                    'volume':50,'mute':False,'fullscreen':False}.get(cmd[1])
        player.ipc=ipc
        return player
    def test_mpv_single_spanish_audio_is_not_fabricated_as_multilingual(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=self.make_player(tmp,[{'id':1,'type':'audio','lang':'spa','selected':True}])
            status=p.status()
            self.assertTrue(status['tracks_available'])
            self.assertEqual(status['tracks'],[{'id':1,'type':'audio','language':'spa','title':'','codec':'','selected':True}])
            self.assertEqual(status['state'],'playing')
    def test_probe_failure_distinct_from_zero_tracks(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=self.make_player(tmp,None)
            status=p.status()
            self.assertFalse(status['tracks_available'])
            self.assertEqual(status['tracks'],[])
    def test_audio_and_subtitle_tracks_have_distinct_identities(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=self.make_player(tmp,[{'id':1,'type':'audio','lang':'spa','selected':True},
                 {'id':2,'type':'audio','lang':'eng','selected':False},
                 {'id':3,'type':'sub','lang':'eng','title':'English SDH','selected':False}])
            status=p.status()
            self.assertEqual([v['type'] for v in status['tracks']],['audio','audio','sub'])
            self.assertTrue(status['tracks_available'])
if __name__=='__main__':unittest.main()

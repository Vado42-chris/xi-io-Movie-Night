"""Safe episode-end state regression; no credentials, media or player process."""
import pathlib
import sys
import tempfile
from unittest import TestCase
from unittest.mock import Mock
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / 'player'))
from aries_adapter import Player

class AutoNextEndSignalTest(TestCase):
    def make_player(self, td):
        p=Player(pathlib.Path(td)/'unused.sock',pathlib.Path(td)/'command.json')
        p.imdb_id='tt1234567'
        p.title='Example'
        p.media_type='series'
        p.season=2;p.episode=8
        p.has_played=True
        p.stop_requested=False
        p.socket_state=Mock(return_value=('live',None))
        values={
          'idle-active':False, 'pause':True, 'time-pos':60.0,
          'duration':60.0,'volume':75.0,'mute':False,'fullscreen':False,
          'eof-reached':True,'track-list':[]}
        p.ipc=Mock(side_effect=lambda cmd,optional=False:values.get(cmd[1]))
        return p
    def test_true_eof_keeps_episode_identity_and_reports_ended(self):
        with tempfile.TemporaryDirectory() as td:
            p=self.make_player(td)
            x=p.status()
            self.assertEqual(x['state'],'ended')
            self.assertEqual((x['imdb_id'],x['season'],x['episode']),('tt1234567',2,8))
            self.assertEqual(x['position'],x['duration'])
            p.save_selection=Mock()
            self.assertEqual(p.status()['state'],'ended')
            p.save_selection.assert_not_called()
    def test_incomplete_file_or_unrelated_movie_must_not_report_ended(self):
        with tempfile.TemporaryDirectory() as td:
            p=self.make_player(td)
            p.ipc=Mock(side_effect=lambda cmd,optional=False: False if cmd[1]=='eof-reached' else {
                'idle-active':False,'pause':True,'time-pos':32.,'duration':60.,'volume':80.,
                'mute':False,'fullscreen':False,'track-list':[]}.get(cmd[1]))
            self.assertEqual(p.status()['state'],'paused')
            p.media_type='movie'
            self.assertNotEqual(p.status()['state'],'ended')
    def test_stop_never_counts_as_episode_completion(self):
        with tempfile.TemporaryDirectory() as td:
            p=self.make_player(td)
            p.stop_requested=True
            self.assertEqual(p.status()['state'],'idle')

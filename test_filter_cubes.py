"""Private query document, conflict and restart tests. No real library/account access."""
import copy
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch
import filter_cubes as cubes

def row(i=0):
    return {'id':f'cube-{i}','name':f'Cube {i}','collectionId':'top100-1980-1995','browse':None,
            'filters':{'yearFrom':'1980','yearTo':'1995','include':[],'exclude':[],'genreMode':'any','rating':0,'runtime':'','type':'','watch':''},
            'search':'','genre':'','sort':'rank','anchor':None}

class CubeTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.store=Path(self.tmp.name)/'private/filter-cubes.json'
        patcher=patch.object(cubes,'STORE',self.store);patcher.start();self.addCleanup(patcher.stop)
    def document(self,n=2):
        d=cubes.read_document();d['rows']=[row(i) for i in range(n)];d['view']='carousel';d['selected_id']=d['rows'][0]['id'] if n else None;return d
    def test_no_write_on_initial_read(self):
        self.assertEqual(cubes.read_document()['rows'],[]);self.assertFalse(self.store.exists())
    def test_more_than_twenty_rows_and_cold_process_readback(self):
        saved=cubes.save_document(self.document(45));self.assertEqual(len(saved['rows']),45)
        code='import json,sys;from pathlib import Path;import filter_cubes;cubes=filter_cubes;cubes.STORE=Path(sys.argv[1]);print(json.dumps(cubes.read_document()))'
        run=subprocess.run([sys.executable,'-c',code,str(self.store)],cwd=Path(cubes.__file__).parent,text=True,capture_output=True,check=True)
        self.assertEqual(json.loads(run.stdout),saved)
        self.assertEqual(self.store.stat().st_mode&0o777,0o600)
        self.assertEqual(self.store.parent.stat().st_mode&0o777,0o700)
    def test_reorder_remove_only_query_document(self):
        current=cubes.save_document(self.document(3));library=self.store.parent/'personal-library.json';library.write_bytes(b'PRIVATE_LIBRARY_SENTINEL')
        settings=self.store.parent/'app-settings.json';settings.write_bytes(b'PRIVATE_SETTINGS_SENTINEL')
        current['rows']=[current['rows'][2],current['rows'][0]]
        changed=cubes.save_document(current)
        self.assertEqual([r['id'] for r in changed['rows']],['cube-2','cube-0'])
        self.assertEqual(library.read_bytes(),b'PRIVATE_LIBRARY_SENTINEL');self.assertEqual(settings.read_bytes(),b'PRIVATE_SETTINGS_SENTINEL')
    def test_conflict_preserves_winner(self):
        old=self.document();saved=cubes.save_document(old)
        with self.assertRaises(cubes.CubeError) as e:cubes.save_document(old)
        self.assertEqual(e.exception.code,'revision_conflict');self.assertEqual(cubes.read_document(),saved)
    def test_no_playlist_membership_or_extra_fields(self):
        d=self.document();d['rows'][0]['movies']=['tt1234567']
        with self.assertRaises(cubes.CubeError):cubes.save_document(d)
        self.assertFalse(self.store.exists())
    def test_identity_range_and_bool_revision_denied(self):
        for mutate in [lambda d:d['rows'].append(copy.deepcopy(d['rows'][0])),lambda d:d.update(selected_id='foreign'),lambda d:d.update(revision=True),lambda d:d['rows'][0]['filters'].update(yearFrom='1995',yearTo='1980')]:
            d=self.document();mutate(d)
            with self.assertRaises(cubes.CubeError):cubes.save_document(d)
    def test_corruption_not_replaced(self):
        cubes.save_document(self.document());self.store.write_text('bad json');before=self.store.read_bytes()
        with self.assertRaises(cubes.CubeError):cubes.save_document({'schema':'movie-night.filter-cubes/v1','revision':0,'view':'wall','rows':[],'selected_id':None})
        self.assertEqual(self.store.read_bytes(),before)
    def test_symlink_file_denied(self):
        self.store.parent.mkdir(mode=0o700);target=self.store.parent/'unrelated';target.write_text('untouched');self.store.symlink_to(target)
        with self.assertRaises(cubes.CubeError):cubes.read_document()
        self.assertEqual(target.read_text(),'untouched')
    def test_host_and_origin_guard(self):
        raw=json.dumps(self.document()).encode()
        h=SimpleNamespace(path='/api/filter-cubes',command='POST',server=SimpleNamespace(server_port=8888),headers={'Host':'localhost:8888','Origin':'https://untrusted.invalid','X-Movie-Night':'1','Content-Type':'application/json','Content-Length':str(len(raw))},rfile=io.BytesIO(raw),connection=Mock(),json_response=Mock())
        self.assertTrue(cubes.handle(h));self.assertEqual(h.json_response.call_args.args[0],403);self.assertFalse(self.store.exists())
    def test_duplicate_json_denied(self):
        with self.assertRaises(ValueError):cubes.decode('{"rows":[],"rows":[]}')

if __name__=='__main__':unittest.main()

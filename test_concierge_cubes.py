"""Chat proposes the existing cube row; only the existing service writes it."""
import copy,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch,Mock
import concierge,filter_cubes
from test_filter_cubes import row
from test_settings import SettingsFixture

class CubeProposalTest(SettingsFixture):
    def setUp(self):
        super().setUp()
        p=patch.object(filter_cubes,'STORE',self.directory/'cubes/filter-cubes.json');p.start();self.addCleanup(p.stop)
        self.document=filter_cubes.read_document(); self.base=row(1);self.base['collectionId']='library'
        self.base['filters'].update(yearFrom='',yearTo='',type='movie',provider='')
        self.query={k:copy.deepcopy(v) for k,v in self.base.items() if k not in ('id','name','anchor')}
    def payload(self,text='Create a live cube of Western movies since 1985',cube_id=None):
        return {'messages':[{'role':'user','content':text}], 'cube_context':{'revision':filter_cubes.read_document()['revision'],'cube_id':cube_id,'query':copy.deepcopy(self.query)}}
    def model(self,request,path_payload=None,**kwargs):
        if request=='/api/tags':return {'models':[{'name':'llama3.1:8b'}]}
        schema_prompt=json.loads(path_payload['messages'][0]['content'].split('INPUT_JSON\n',1)[1])
        result=copy.deepcopy(schema_prompt['row']);result['name']='Westerns since 1985';result['genre']='Western';result['filters']['yearFrom']='1985'
        return {'message':{'content':json.dumps({'row':result,'unsupported':[]})}}
    def test_create_is_schema_valid_proposal_without_writing_or_snapshot(self):
        with patch.object(concierge,'_ollama',side_effect=self.model): result=concierge.chat(self.payload())
        op=result['cube_operation'];self.assertEqual(op['action'],'create');self.assertEqual(op['expected_revision'],0)
        self.assertNotIn('collection',result);self.assertEqual(op['row']['filters']['yearFrom'],'1985')
        d=filter_cubes.read_document();d['rows']=[op['row']];d['selected_id']=op['cube_id'];filter_cubes.validate(d)
        self.assertFalse(filter_cubes.STORE.exists());self.assertTrue(result['review_required'])
    def test_generation_schema_is_derived_and_identity_is_const(self):
        captured=[]
        def model(url,payload=None,**kwargs):
            if url=='/api/chat':captured.append(payload)
            return self.model(url,payload,**kwargs)
        with patch.object(concierge,'_ollama',side_effect=model):result=concierge.chat(self.payload('Create a cube of thoughtful Western movies since 1985'))
        contract=captured[0]['format'];self.assertFalse(contract['additionalProperties'])
        self.assertEqual(set(contract['required']),{'row','unsupported'})
        self.assertEqual(contract['properties']['row']['properties']['id']['const'],result['cube_operation']['cube_id'])
        self.assertEqual(contract['properties']['row']['properties']['collectionId']['const'],'library')
        expected=copy.deepcopy(filter_cubes.CONTRACT['properties']['rows']['items']['properties']['filters'])
        for key in ('include','exclude'):expected['properties'][key]['items']={'enum':list(concierge._GENRES)}
        self.assertEqual(contract['properties']['row']['properties']['filters'],expected)
    def test_stale_revision_fails_before_model_or_write(self):
        p=self.payload();p['cube_context']['revision']=123
        with patch.object(concierge,'_ollama') as model,self.assertRaises(concierge.ConciergeError):concierge.chat(p)
        model.assert_not_called();self.assertFalse(filter_cubes.STORE.exists())
    def test_edit_uses_existing_id_and_does_not_write(self):
        d=filter_cubes.read_document();d['rows']=[self.base];d['selected_id']=self.base['id'];filter_cubes.save_document(d);before=filter_cubes.STORE.read_bytes()
        with patch.object(concierge,'_ollama',side_effect=self.model):result=concierge.chat(self.payload('Edit this cube to Western movies since 1985',self.base['id']))
        self.assertEqual(result['cube_operation']['cube_id'],self.base['id']);self.assertEqual(filter_cubes.STORE.read_bytes(),before)
    def test_removal_proposal_requires_exact_target_and_has_no_effect(self):
        d=filter_cubes.read_document();d['rows']=[self.base];d['selected_id']=self.base['id'];filter_cubes.save_document(d);before=filter_cubes.STORE.read_bytes()
        with patch.object(concierge,'_ollama') as model:result=concierge.chat(self.payload('Remove this cube',self.base['id']))
        model.assert_not_called();self.assertEqual(result['cube_operation']['action'],'remove');self.assertEqual(filter_cubes.STORE.read_bytes(),before)
        with self.assertRaises(concierge.ConciergeError):concierge.chat(self.payload('Remove this cube','not-the-cube'))
    def test_model_cannot_retarget_source_or_add_execution_fields(self):
        for mutate in [lambda r:r.update(collectionId='another-library'),lambda r:r.update(command='write file'),lambda r:r['filters'].update(genreMode='anything'),lambda r:r['filters'].update(include=['genre=Western'])]:
            def model(url,payload=None,**kw):
                answer=self.model(url,payload,**kw)
                if url=='/api/chat':
                    data=json.loads(answer['message']['content']);mutate(data['row']);answer['message']['content']=json.dumps(data)
                return answer
            with self.subTest(mutate=mutate),patch.object(concierge,'_ollama',side_effect=model),self.assertRaises(concierge.ConciergeError):concierge.chat(self.payload('Create a cube of thoughtful Western movies since 1985'))
        self.assertFalse(filter_cubes.STORE.exists())
    def test_unsupported_filters_are_not_silently_dropped(self):
        def model(url,payload=None,**kw):
            answer=self.model(url,payload,**kw)
            if url=='/api/chat':
                data=json.loads(answer['message']['content']);data['unsupported']=['subscription entitlement'];answer['message']['content']=json.dumps(data)
            return answer
        with patch.object(concierge,'_ollama',side_effect=model),self.assertRaises(concierge.ConciergeError):concierge.chat(self.payload('Create a cube of movies included in my Prime subscription'))
        self.assertFalse(filter_cubes.STORE.exists())
    def test_origin_rejection_does_not_prepare_or_write(self):
        handler=self.handler('/api/concierge/chat','POST',self.payload());handler.headers['Origin']='https://other.invalid'
        with patch.object(concierge,'chat') as chat:concierge.handle(handler)
        chat.assert_not_called();self.assertEqual(handler.json_response.call_args.args[0],403)
    def test_disabled_concierge_keeps_cube_store_unchanged(self):
        self.save('plugins','ollama_enabled',False)
        with patch.object(concierge,'_ollama') as model,self.assertRaises(concierge.ConciergeError):concierge.chat(self.payload())
        model.assert_not_called();self.assertFalse(filter_cubes.STORE.exists())
    def test_shared_present_boundary_is_not_frozen(self):
        d=filter_cubes.read_document();d['rows']=[self.base];d['selected_id']=self.base['id'];d['rows'][0]['filters'].update(yearFrom='1985',yearTo='present')
        stored=filter_cubes.save_document(d);self.assertEqual(stored['rows'][0]['filters']['yearTo'],'present')
    def test_rolling_current_year_rejects_future_lower_bound(self):
        from datetime import datetime,timezone
        d=filter_cubes.read_document();d['rows']=[self.base];d['selected_id']=self.base['id']
        d['rows'][0]['filters'].update(yearFrom=str(datetime.now(timezone.utc).year+1),yearTo='present')
        with self.assertRaises(filter_cubes.CubeError):filter_cubes.save_document(d)
        self.assertFalse(filter_cubes.STORE.exists())
    def test_older_writer_cannot_erase_existing_rolling_bound(self):
        current=filter_cubes.read_document();current['rows']=[self.base];current['selected_id']=self.base['id']
        current['rows'][0]['filters'].update(yearFrom='1985',yearTo='present');saved=filter_cubes.save_document(current)
        older=copy.deepcopy(saved);older['rows'][0]['filters']['yearTo']=''
        before=filter_cubes.STORE.read_bytes();handler=self.handler('/api/filter-cubes','POST',older)
        filter_cubes.handle(handler);self.assertEqual(handler.json_response.call_args.args[0],409)
        self.assertEqual(filter_cubes.STORE.read_bytes(),before)
        handler=self.handler('/api/filter-cubes','POST',older);handler.headers['X-Movie-Night-Cube-Features']='rolling-year-bound-v1'
        filter_cubes.handle(handler);self.assertEqual(handler.json_response.call_args.args[0],200)
        self.assertEqual(filter_cubes.read_document()['rows'][0]['filters']['yearTo'],'')
    def test_year_to_present_does_not_collapse_to_single_year(self):
        from datetime import datetime,timezone
        for phrase in ['from 1985-to present','1985 to now','1985 through present']:
            parsed=concierge._constraints(phrase);self.assertEqual(parsed['year_min'],1985);self.assertEqual(parsed['year_max'],datetime.now(timezone.utc).year)

    def test_exact_western_request_needs_no_model_and_no_write(self):
        with patch.object(concierge, '_ollama', side_effect=AssertionError('No inference for explicit filters')):
            result = concierge.chat(self.payload('can you create me a cube of western novies from 1985-to present?'))
        op = result['cube_operation']
        self.assertEqual(op['row']['genre'], 'Western')
        self.assertEqual(op['row']['filters']['type'], 'movie')
        self.assertEqual(op['row']['filters']['yearFrom'], '1985')
        self.assertEqual(op['row']['filters']['yearTo'], 'present')
        self.assertEqual(op['source_scope'], 'library')
        self.assertFalse(filter_cubes.STORE.exists())

    def test_high_fantasy_is_explicit_broader_review_not_silent_approximation(self):
        with patch.object(concierge, '_ollama', side_effect=AssertionError('Explicit filters do not need inference')):
            result = concierge.chat(self.payload('can you make me a cube of movies from 2010-2015 that are high fantasy?'))
        row = result['cube_operation']['row']
        self.assertEqual(row['genre'], 'Fantasy')
        self.assertEqual((row['filters']['yearFrom'], row['filters']['yearTo']), ('2010', '2015'))
        self.assertIn('broader', result['message'].lower())
        self.assertTrue(result['review_notes'])
        self.assertNotIn('high fantasy', row['name'].lower())
        self.assertTrue(result['review_required'])
        self.assertFalse(filter_cubes.STORE.exists())

    def test_movie_selection_is_not_new_cube_membership(self):
        payload = self.payload('Create a cube of Western movies since 1985')
        payload['context'] = {'ids': ['series:tt2364582'], 'selected': 'series:tt2364582'}
        with patch.object(concierge, '_ollama', side_effect=AssertionError('No inference')):
            result = concierge.chat(payload)
        self.assertEqual(result['cube_operation']['row']['filters']['type'], 'movie')
        self.assertEqual(result['cube_operation']['source_scope'], 'library')
        self.assertNotIn('collection', result)

    def test_exact_request_remains_draft_with_no_matching_titles(self):
        with patch.object(concierge, '_ollama', side_effect=AssertionError('No inference')):
            result = concierge.chat(self.payload('Create a cube of Western movies from 1985 to present'))
        self.assertTrue(result['review_required'])
        self.assertFalse(filter_cubes.STORE.exists())

if __name__=='__main__':unittest.main()

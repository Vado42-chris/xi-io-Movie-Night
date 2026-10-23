"""Real Movie Night HTTP Bin writer, disposable data, synthetic catalogue/player.
No real accounts, private media, model invocation, native window or live service.
"""
from pathlib import Path
import sys, tempfile, threading, subprocess, os, json, copy, hashlib
from urllib.parse import urlsplit, parse_qs
root=Path(sys.argv[1]).resolve();out=Path(sys.argv[2]).resolve();out.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(root))
import server, filter_cubes, app_settings, personal_library
items=[
 {'id':'tt8400001','imdbId':'tt8400001','imdb_id':'tt8400001','type':'movie','title':'Frontier One','year':1990,'genres':['Western'],'runtime':100},
 {'id':'tt8400002','imdbId':'tt8400002','imdb_id':'tt8400002','type':'movie','title':'Frontier Two','year':2012,'genres':['Western'],'runtime':105},
 {'id':'tt8400003','imdbId':'tt8400003','imdb_id':'tt8400003','type':'movie','title':'Early Frontier','year':1960,'genres':['Western'],'runtime':110},
 {'id':'tt8400004','imdbId':'tt8400004','imdb_id':'tt8400004','type':'movie','title':'Castle in the Clouds','year':2013,'genres':['Fantasy'],'runtime':120},
 {'id':'tt8400005','imdbId':'tt8400005','imdb_id':'tt8400005','type':'series','title':'Frontier Stories','year':2011,'genres':['Western'],'runtime':42},
]
with tempfile.TemporaryDirectory(prefix='movie-night-manual-ui-') as temp:
 private=Path(temp)/'private';private.mkdir(mode=0o700)
 for mod,name in [(filter_cubes,'filter-cubes.json'),(app_settings,'settings.json'),(personal_library,'personal-library.json')]:mod.STORE=private/name
 initial=copy.deepcopy(filter_cubes.CONTRACT['default'])
 for kind in ['movie','series']:
  initial['rows'].append({'id':'fixture-'+kind,'name':'Fixture '+kind,'collectionId':'browse-'+kind,'browse':{'catalog':'top','genre':'','year':'2026','search':''},'filters':{'yearFrom':'','yearTo':'','include':[],'exclude':[],'genreMode':'any','rating':0,'runtime':'','type':kind,'watch':'','provider':''},'search':'','genre':'','sort':'rank','anchor':None})
 initial['selected_id']='fixture-movie';initial['view']='carousel';filter_cubes.save_document(initial)
 server.read_library=lambda:{'title':'Movie Night','collections':[{'id':'fixture-curated','name':'Fixture shelf','description':'Synthetic test data','movies':copy.deepcopy(items[:4])}]}
 calls={'writes':0,'ai':0,'player':[],'catalogue':[]}; fixture_state={'state':'idle','type':'movie','title':'','imdb_id':'','volume':50}
 class Handler(server.Handler):
  mode='normal';deny=False
  def log_message(self,*args):pass
  def json_response(self,status,payload):
   if self.command=='POST' and urlsplit(self.path).path=='/api/filter-cubes' and status==200:
    calls['writes']+=1
    if type(self).mode=='deny-readback':type(self).deny=True
   return super().json_response(status,payload)
  def do_GET(self):
   u=urlsplit(self.path);q=parse_qs(u.query);p=u.path
   if p.startswith('/api/concierge') or p.startswith('/api/ai-suggestions'):
    calls['ai']+=1;self.json_response(503,{'error':'AI disabled for this manual-user test'});return
   if p=='/__test/state':self.json_response(200,{'calls':calls,'document':filter_cubes.read_document()});return
   if p=='/api/player/status':self.json_response(200,fixture_state);return
   if p=='/api/personal-library':
    self.json_response(200,{'favorites':[items[0]],'recent':[{**items[4],'season':1,'episode':2,'lastPositionMs':120000,'durationMs':2400000}],'watched':[],'collections':[{'id':'nuvio-library','name':'Fixture imported library','movies':copy.deepcopy(items)}],'imported_at':None});return
   if p=='/api/filter-cubes' and type(self).deny:self.json_response(503,{'error':'Synthetic readback unavailable'});return
   if p=='/api/browse':
    calls['catalogue'].append({k:v[0] for k,v in q.items()});kind=q.get('type',['movie'])[0];term=q.get('search',[''])[0].lower();genre=q.get('genre',[''])[0]
    rows=[x for x in items if x['type']==kind and (not term or term in x['title'].lower()) and (not genre or genre in x['genres'] or genre.isdigit())]
    self.json_response(200,{'movies':copy.deepcopy(rows),'has_more':False,'next_skip':0});return
   if p=='/api/browse/meta':
    item=next((x for x in items if x['id']==q.get('id',[''])[0]),None)
    if not item:self.json_response(404,{'error':'fixture title missing'});return
    item=copy.deepcopy(item);item['description']='Fixture plot, no provider calls.'
    if item['type']=='series':item['episodes']=[{'id':item['id']+':1:'+str(n),'season':1,'episode':n,'title':'Episode '+str(n),'released':'2020-01-01'} for n in [1,2,3]]
    self.json_response(200,{'movie':item});return
   return super().do_GET()
  def do_POST(self):
   p=urlsplit(self.path).path
   if p=='/__test/mode':
    value=json.loads(self.rfile.read(int(self.headers['Content-Length'])));type(self).mode=value['mode'];type(self).deny=False
    if value['mode']=='advance':filter_cubes.save_document(filter_cubes.read_document())
    self.json_response(200,{'fixture':True});return
   if p.startswith('/api/player/'):
    body=json.loads(self.rfile.read(int(self.headers['Content-Length'])));calls['player'].append({'path':p,'body':body})
    if p.endswith('/sources'):self.json_response(200,{**body,'sources':[{'id':'synthetic_source_abcdefghijk','quality':'1080p','label':'Fixture source'}]});return
    if p.endswith('/play'):fixture_state.update({**body,'state':'playing'});self.json_response(202,fixture_state);return
    if p.endswith('/command'):fixture_state['state']='idle' if body.get('command')=='stop' else 'paused';self.json_response(200,fixture_state);return
   if p!='/api/filter-cubes':self.json_response(403,{'error':'fixture denies unrelated effects'});return
   if type(self).mode=='refuse':self.rfile.read(int(self.headers['Content-Length']));self.json_response(403,{'error':'Synthetic write refusal'});return
   return super().do_POST()
 host=server.ThreadingHTTPServer(('127.0.0.1',0),Handler);server.player_gateway.configure(host,None,1)
 t=threading.Thread(target=host.serve_forever,daemon=True);t.start()
 try:
  env={**os.environ,'MOVIE_NIGHT_URL':f'http://127.0.0.1:{host.server_port}'}
  result=subprocess.run(['node',str(root/'verification/verify-manual-media.cjs'),str(out)],cwd=root,env=env,capture_output=True,text=True,timeout=240)
  (out/'browser.log').write_text(result.stdout+result.stderr)
  observed=filter_cubes.read_document()
  cold=subprocess.run([sys.executable,'-c',"import sys,json;from pathlib import Path;import filter_cubes;filter_cubes.STORE=Path(sys.argv[1]);print(json.dumps(filter_cubes.read_document()))",str(filter_cubes.STORE)],cwd=root,capture_output=True,text=True,check=True)
  assert json.loads(cold.stdout)==observed
  summary={'browser_exit':result.returncode,'real_http_writer':True,'fresh_process_readback':True,'revision':observed['revision'],'rows':len(observed['rows']),'ai_calls':calls['ai'],'fixture_write_count':calls['writes'],'real_playback':False,'native_window':False,'user_data_changed':False}
  (out/'summary.json').write_text(json.dumps(summary,indent=2));print('MANUAL_MEDIA_RESULT',json.dumps(summary));print(result.stdout[-14000:]);print(result.stderr[-2500:]);sys.exit(result.returncode)
 finally:host.shutdown();host.server_close();t.join()

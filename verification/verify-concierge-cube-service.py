"""Exercise actual Movie Night handlers with disposable private stores.
Usage: python3 verification/verify-concierge-cube-service.py REPO_ROOT OUTPUT
Set MOVIE_NIGHT_PLAYWRIGHT and MOVIE_NIGHT_CHROME for installed browser tooling.
Default model is a fixture. MOVIE_NIGHT_REAL_MODEL=1 explicitly uses local Ollama.
No user library, account, live host service or media writes are permitted.
"""
from pathlib import Path
import sys,tempfile,threading,subprocess,os,json,copy
from urllib.parse import urlsplit, unquote
from html.parser import HTMLParser

class ShellEntryAssets(HTMLParser):
    """Inspect the built Vite entry without executing it or making a request."""
    def __init__(self):
        super().__init__()
        self.scripts = []
        self.styles = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'script' and attrs.get('src'):
            self.scripts.append(attrs['src'])
        if tag == 'link' and 'stylesheet' in attrs.get('rel', '').split() and attrs.get('href'):
            self.styles.append(attrs['href'])


def require_shell_build(root):
    """Fail before opening a test server or touching any disposable store."""
    root = Path(root).resolve()
    build = root / 'studio-web'
    entry = build / 'index.html'
    instruction = ('From the repository root run: npm --prefix studio-shell ci '
                   '--ignore-scripts --no-audit --no-fund && '
                   'npm --prefix studio-shell run build. See README.md, '
                   'Reproduce the concierge checks from a clean checkout.')
    if not (root / 'studio-shell/package-lock.json').is_file():
        raise RuntimeError('SHELL_LOCK_MISSING: use the reviewed checkout containing the shell lockfile. ' + instruction)
    if not entry.is_file():
        raise RuntimeError('SHELL_BUILD_MISSING: /studio/ requires studio-web/index.html. ' + instruction)
    parser = ShellEntryAssets()
    parser.feed(entry.read_text(encoding='utf-8'))
    if not parser.scripts or not parser.styles:
        raise RuntimeError('SHELL_BUILD_INCOMPLETE: the entry needs its script and stylesheet. ' + instruction)
    for reference in parser.scripts + parser.styles:
        parsed = urlsplit(reference)
        if parsed.scheme or parsed.netloc or not parsed.path.startswith('/studio/'):
            raise RuntimeError('SHELL_ASSET_INVALID: the entry must reference its own /studio/ build.')
        asset = (build / unquote(parsed.path.removeprefix('/studio/'))).resolve()
        if not asset.is_relative_to(build.resolve()):
            raise RuntimeError('SHELL_ASSET_INVALID: an asset escapes the selected build.')
        if not asset.is_file():
            raise RuntimeError('SHELL_BUILD_INCOMPLETE: an entry script or stylesheet is missing. ' + instruction)


def main():
    if len(sys.argv) != 3:
        raise SystemExit('Usage: python3 verification/verify-concierge-cube-service.py REPO_ROOT OUTPUT')
    root = Path(sys.argv[1]).resolve()
    try:
        require_shell_build(root)
    except (RuntimeError, OSError, UnicodeError) as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(2)
    # Build prerequisites are checked before importing runtime modules or starting HTTP.
    sys.path.insert(0, str(root))
    import server, filter_cubes, personal_library, app_settings, concierge
    root=Path(sys.argv[1]);output=Path(sys.argv[2]);output.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='movie-night-chat-cubes-') as temp:
        private=Path(temp)/'private';private.mkdir(mode=0o700)
        filter_cubes.STORE=private/'filter-cubes.json';personal_library.STORE=private/'personal-library.json';app_settings.STORE=private/'settings.json'
        model_calls=[]
        def model(path,payload=None,**kwargs):
            model_calls.append(path)
            if path=='/api/tags':return {'models':[{'name':'llama3.1:8b'}]}
            data=json.loads(payload['messages'][0]['content'].split('INPUT_JSON\n',1)[1]);row=copy.deepcopy(data['row']);request=payload['messages'][-1]['content']
            row['filters'].update(type='movie',yearFrom='1995' if '1995' in request else '1985',yearTo='' if 'since' in request else 'present');row['genre']='Western'
            if data['action']=='create':row['name']='Westerns since 1985'
            return {'message':{'content':json.dumps({'row':row,'unsupported':[]})}}
        if os.environ.get('MOVIE_NIGHT_REAL_MODEL')!='1':concierge._ollama=model
        items=[{'id':'tt8400001','imdbId':'tt8400001','type':'movie','title':'Western fixture','year':1990,'genres':['Western'],'runtime':100}, {'id':'tt8400002','imdbId':'tt8400002','type':'movie','title':'Later western fixture','year':2000,'genres':['Western'],'runtime':110}]
        if os.environ.get('MOVIE_NIGHT_EXACT_REQUESTS')=='1':
            items.extend([{'id':'tt8400003','imdbId':'tt8400003','type':'movie','title':'Fantasy fixture','year':2012,'genres':['Fantasy'],'runtime':100}, {'id':'tt8400004','imdbId':'tt8400004','type':'movie','title':'Later fantasy excluded','year':2018,'genres':['Fantasy'],'runtime':100}, {'id':'tt8400005','imdbId':'tt8400005','type':'series','title':'Fantasy series excluded','year':2012,'genres':['Fantasy'],'runtime':45}])
        class IsolatedHandler(server.Handler):
            mode='normal';deny=False
            def do_GET(self):
                path=urlsplit(self.path).path
                if path=='/api/player/status':self.json_response(200,{'state':'idle','type':'movie','title':'','imdb_id':'','volume':50});return
                if path=='/api/personal-library':self.json_response(200,{'favorites':[],'recent':[],'watched':[],'collections':[{'id':'nuvio-library','name':'Fixture library','movies':items}],'imported_at':None});return
                if path=='/api/filter-cubes' and type(self).deny:self.json_response(403,{'error':'Readback denied by test'});return
                return super().do_GET()
            def do_POST(self):
                path=urlsplit(self.path).path
                if path=='/__test/mode':
                    value=json.loads(self.rfile.read(int(self.headers['Content-Length'])));type(self).mode=value['mode'];type(self).deny=False;self.json_response(200,{'test_only':True});return
                if path not in ['/api/filter-cubes','/api/concierge/chat']:self.json_response(403,{'error':'Test blocks non-cube effects'});return
                super().do_POST()
                if path=='/api/filter-cubes' and type(self).mode=='deny-read-after-write':type(self).deny=True
        host=server.ThreadingHTTPServer(('127.0.0.1',0),IsolatedHandler);server.player_gateway.configure(host,None,1)
        thread=threading.Thread(target=host.serve_forever,daemon=True);thread.start()
        try:
            env={**os.environ,'MOVIE_NIGHT_URL':f'http://127.0.0.1:{host.server_port}'}
            result=subprocess.run(['node',str(root/'verification/verify-concierge-cubes.cjs'),str(output/'browser')],cwd=root,env=env,capture_output=True,text=True,timeout=150)
            (output/'browser.log').write_text(result.stdout+result.stderr)
            observed=filter_cubes.read_document()
            cold=subprocess.run([sys.executable,'-c',"import sys,json;from pathlib import Path;import filter_cubes;filter_cubes.STORE=Path(sys.argv[1]);print(json.dumps(filter_cubes.read_document()))",str(filter_cubes.STORE)],cwd=root,capture_output=True,text=True,check=True)
            assert json.loads(cold.stdout)==observed
            summary={'browser_exit':result.returncode,'actual_http_writer':True,'cold_process_readback':True,'stored_rows':len(observed['rows']),'revision':observed['revision'],'model':'real_local' if os.environ.get('MOVIE_NIGHT_REAL_MODEL')=='1' else 'fixture','model_calls':len(model_calls),'inference_calls':model_calls.count('/api/chat'),'status_calls':model_calls.count('/api/tags'),'user_data_changed':False,'worker_admission':False,'parent_apply_return':False}
            (output/'summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary));print(result.stdout[-6500:]);print(result.stderr[-1500:])
            if result.returncode:raise SystemExit(result.returncode)
        finally:host.shutdown();host.server_close();thread.join()


if __name__ == '__main__':
    main()

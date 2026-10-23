"""Run no-AI discovery regression with public schemas and synthetic private data.
Usage: python3 verification/verify-discovery-recovery.py REPO_ROOT OUTPUT
No service required: the browser runner intercepts every API and asset request.
Set MOVIE_NIGHT_PLAYWRIGHT / MOVIE_NIGHT_CHROME to your existing browser tools.
"""
from pathlib import Path
import copy,json,os,subprocess,sys,tempfile
root=Path(sys.argv[1]).resolve();output=Path(sys.argv[2]).resolve();output.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(root));import app_settings,filter_cubes
record=copy.deepcopy(filter_cubes.CONTRACT['default'])
record.update(view='carousel',selected_id='regression-bin')
record['rows']=[{'id':'regression-bin','name':'Fixture Bin','collectionId':'browse-movie',
 'browse':{'catalog':'top','genre':'','year':'2026','search':''},
 'filters':{'yearFrom':'','yearTo':'','include':[],'exclude':[],'genreMode':'any','rating':0,'runtime':'','type':'movie','watch':'','provider':''},
 'search':'','genre':'','sort':'rank','anchor':None}]
fixture={'settings':{'revision':0,'settings':app_settings.DEFAULTS},'settingsDeclaration':app_settings.DECLARATION,
         'cubeDeclaration':filter_cubes.CONTRACT,'cubes':record}
with tempfile.TemporaryDirectory(prefix='movie-night-discovery-fixture-') as tmp:
    p=Path(tmp)/'fixture.json';p.write_text(json.dumps(fixture))
    env={**os.environ,'MOVIE_NIGHT_DISCOVERY_FIXTURE':str(p)}
    result=subprocess.run(['node',str(root/'verification/verify-discovery-recovery.cjs'),str(output)],cwd=root,env=env,capture_output=True,text=True,timeout=180)
    (output/'browser.log').write_text(result.stdout+result.stderr)
    print(result.stdout[-2200:]);print(result.stderr[-1000:]);sys.exit(result.returncode)

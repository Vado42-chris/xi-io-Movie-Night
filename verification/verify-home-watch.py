"""Source UI acceptance using generated schemas, synthetic media and no live APIs."""
from pathlib import Path
import copy,json,os,subprocess,sys,tempfile
root=Path(sys.argv[1]).resolve();out=Path(sys.argv[2]).resolve();out.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(root));import app_settings,filter_cubes
record=copy.deepcopy(filter_cubes.CONTRACT['default']);record.update(revision=7,view='carousel',selected_id='starter-all-movies-20261023')
record['rows']=[]
for kind in ['movie','series']:
 record['rows'].append({'id':'starter-all-'+('movies' if kind=='movie' else 'tv')+'-20261023','name':'All Movies' if kind=='movie' else 'All TV','collectionId':'browse-'+kind,'browse':{'catalog':'top','genre':'','year':'2026','search':''},'filters':{'yearFrom':'','yearTo':'','include':[],'exclude':[],'genreMode':'any','rating':0,'runtime':'','type':kind,'watch':'','provider':''},'search':'','genre':'','sort':'rank','anchor':None})
record['rows'].append({**copy.deepcopy(record['rows'][0]),'id':'personal-westerns','name':'Weekend Westerns','collectionId':'library'})
fixture={'settings':{'revision':0,'settings':app_settings.DEFAULTS},'declaration':app_settings.DECLARATION,'cubeDeclaration':filter_cubes.CONTRACT,'cubes':record}
with tempfile.TemporaryDirectory(prefix='movie-home-watch-') as tmp:
 p=Path(tmp)/'fixture.json';p.write_text(json.dumps(fixture));env={**os.environ,'MOVIE_NIGHT_HOME_FIXTURE':str(p)}
 result=subprocess.run(['node',str(root/'verification/verify-home-watch.cjs'),str(out)],cwd=root,env=env,capture_output=True,text=True,timeout=240)
 (out/'browser.log').write_text(result.stdout+result.stderr);print(result.stdout[-14000:]);print(result.stderr[-1000:]);sys.exit(result.returncode)

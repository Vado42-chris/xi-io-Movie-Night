"use strict";
// Real app code and browser events. Provider metadata/player replies are fixtures.
// No real media is loaded, no personal library or account is changed.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {chromium}=require(process.env.MOVIE_NIGHT_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..'),output=path.resolve(process.argv[2]);fs.mkdirSync(output,{recursive:true});
const series={id:'tt4798814',imdb_id:'tt4798814',type:'series',title:'Episode identity fixture',year:2016,genres:['Comedy'],description:'Synthetic selection fixture',poster:''};
const episodes=[{id:series.id+':0:1',season:0,episode:1,title:'Special'},...Array.from({length:3},(_,i)=>({id:series.id+':1:'+(i+1),season:1,episode:i+1,title:'Duplicate title',overview:'A fixture, not a playable episode.'}))];

async function verifyAllSeries(browser, output) {
 const census=process.env.MOVIE_NIGHT_SERIES_CENSUS ? JSON.parse(fs.readFileSync(process.env.MOVIE_NIGHT_SERIES_CENSUS,'utf8')) : null;
 const ids=census ? [...new Set(census.occurrences.filter(x=>x.supported_identity).map(x=>x.id))] : Array.from({length:16},(_,i)=>`tt${8100000+i}`);
 assert.ok(ids.length>1,'multi-series coverage cannot collapse to one title');
 const items=ids.map((id,i)=>({id,imdbId:id,type:i%2?'tv':'series',title:`Series binding fixture ${i+1}`,year:2001,genres:['Comedy'],poster:''}));
 const byId=new Map(items.map(x=>[x.id,x]));
 const eps=id=>[0,1,2].flatMap(season=>[1,2].map(episode=>({id:`${id}:${season}:${episode}`,season,episode,title:'Same episode title',overview:'Synthetic metadata for identity testing only.'})));
 const report={width:'all-series-entry-paths',proof:'REAL_BROWSER_CARD_EVENTS_WITH_SYNTHETIC_METADATA',realPlayback:false,censusBasis:census?'private library identities, not live episode metadata':'generated series identities',totalSeries:ids.length,linkedSeries:0,checks:[],errors:[],unexpectedWrites:[]};
 const ctx=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block',reducedMotion:'reduce'}),page=await ctx.newPage();page.setDefaultTimeout(10000);
 const calls=[],modes=new Map(),counts=new Map();let cubeRecord={revision:0,view:'wall',selected_id:null,rows:[]};
 page.on('pageerror',e=>report.errors.push(e.message));
 await ctx.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());if(u.origin!=='http://127.0.0.1:8789')return route.abort();
  const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(u.pathname==='/api/filter-cubes') {
   if(req.method()==='POST')cubeRecord={...req.postDataJSON(),revision:cubeRecord.revision+1};
   return reply(cubeRecord);
  }
  if(req.method()!=='GET'){report.unexpectedWrites.push(u.pathname);return reply({error:'Blocked by read-only acceptance test'},403);}
  if(u.pathname.startsWith('/api/player/'))return reply({state:'idle',imdb_id:'',type:'movie',title:'',volume:50});
  if(u.pathname==='/api/personal-library')return reply({favorites:[items[0]],recent:[items[1]],watched:[],imported_at:null,collections:[{id:'nuvio-library',name:'Synthetic imported library',movies:items}]});
  if(u.pathname==='/api/library.json')return reply({title:'Movie Night',collections:[{id:'synthetic-curated',name:'Synthetic curated collection',movies:items.slice(0,2)}]});
  if(u.pathname==='/api/browse')return reply({movies:items.slice(0,4).map(x=>({...x,type:'series'})),has_more:false,next_skip:0});
  if(u.pathname==='/api/browse/meta'){
   const id=u.searchParams.get('id'),kind=u.searchParams.get('type'),item=byId.get(id);
   calls.push({id,type:kind});counts.set(id,(counts.get(id)||0)+1);assert.equal(kind,'series');assert.ok(item,'unexpected series identity');
   const mode=modes.get(id);if(mode==='slow')await new Promise(r=>setTimeout(r,300));
   if(mode==='offline')return reply({error:'fixture metadata unavailable'},503);
   const movie={...item,type:'series',episodes:eps(id)};
   if(mode==='missing')delete movie.episodes;
   if(mode==='empty')movie.episodes=[];
   if(mode==='wrong')movie.imdbId=movie.id=ids.find(x=>x!==id);
   return reply({movie,source:'synthetic metadata'});
  }
  if(u.pathname==='/app.js'&&process.env.MOVIE_NIGHT_APP_OVERRIDE)return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(process.env.MOVIE_NIGHT_APP_OVERRIDE)});
  const rel=u.pathname==='/'?'index.html':u.pathname.slice(1),file=path.resolve(root,'web',rel);
  if(!process.env.MOVIE_NIGHT_VERIFY_SERVED&&file.startsWith(path.resolve(root,'web')+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({contentType:({'.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.html':'text/html'})[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
  return route.continue();
 });
 async function opened(id){
  await page.waitForFunction(id=>document.querySelector('#episode-list button')?.dataset.episodeId?.startsWith(id+':'),id);
  assert.equal(await page.locator('#dialog-title').innerText(),byId.get(id).title);
  const displayed=await page.locator('#episode-list button').evaluateAll(nodes=>nodes.map(n=>n.dataset.episodeId));
  assert.deepEqual(displayed,[`${id}:1:1`,`${id}:1:2`]);
  assert.deepEqual(await page.locator('#episode-season option').evaluateAll(nodes=>nodes.map(n=>n.value)),['0','1','2']);
  assert.equal(await page.locator('#play-on-aries').isDisabled(),true);
 }
 async function close(){await page.locator('#close-dialog').evaluate(el=>el.click());}
 async function library(){await page.locator('[data-collection="library"]').click();await page.waitForFunction(n=>document.querySelectorAll('#film-grid .movie-card').length===n,ids.length);}
 async function card(index){await page.locator('#film-grid .movie-card').nth(index).evaluate(el=>el.click());}
 try {
  await page.goto('http://127.0.0.1:8789/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.getElementById('cube-add')&&!document.getElementById('cube-add').disabled);
  await library();
  for(let i=0;i<items.length;i++){await card(i);await opened(ids[i]);assert.equal(calls.at(-1).id,ids[i]);await close();report.linkedSeries++;}
  assert.equal(report.linkedSeries,ids.length);report.checks.push('every series card in the selected denominator automatically loads its own episode hierarchy; no Refresh or title-specific code');
  await page.locator('[data-collection="personal-favorites"]').click();await page.locator('#film-grid .movie-card').first().click();await opened(ids[0]);await close();
  await page.locator('[data-collection="personal-recent"]').click();await page.locator('#film-grid .movie-card').first().click();await opened(ids[1]);await close();
  await page.locator('[data-collection="browse-series"]').click();await page.locator('#film-grid .movie-card').first().waitFor();await page.locator('#film-grid .movie-card').first().click();await opened(ids[0]);
  await page.locator('#carousel-next').click();await opened(ids[1]);await close();
  report.checks.push('favorites, recent, catalogue and detail-carousel paths use the same automatic series linkage');
  await library();await page.locator('#cube-add').click();await page.locator('#cube-name').fill('Synthetic series row');await page.locator('#cube-confirm').click();await page.locator('#cube-naming').waitFor({state:'hidden'});
  await page.locator('#cube-home .cube-cover[aria-current=true]').first().click();await opened(ids[0]);await close();
  assert.equal(await page.locator('#cube-home').isVisible(),true);await page.locator('#cube-view-wall').click();
  report.checks.push('saved cube carousel opens the same hierarchy and Back returns to the cube; cube writes are intercepted in memory');
  // A fresh page must recover an incomplete/empty/error response without any
  // hand-authored linkage or Refresh request, simply by reopening the card.
  for(const mode of ['missing','empty','offline','wrong']){
   modes.set(ids[0],mode);cubeRecord={revision:0,view:'wall',selected_id:null,rows:[]};await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.getElementById('cube-add')&&!document.getElementById('cube-add').disabled);await library();await card(0);
   await page.waitForFunction(()=>{const t=document.getElementById('episode-metadata-status')?.textContent||'';return t.includes('could not load')||t.includes('returned no episodes')||t.includes('No episode metadata was returned');});
   assert.equal(await page.locator('#play-on-aries').isDisabled(),true);await close();modes.delete(ids[0]);await card(0);await opened(ids[0]);await close();
  }
  report.checks.push('missing, empty, unavailable and wrong-series metadata stays non-playable and retries automatically on reopen');
  modes.set(ids[0],'slow');cubeRecord={revision:0,view:'wall',selected_id:null,rows:[]};await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.getElementById('cube-add')&&!document.getElementById('cube-add').disabled);await library();await card(0);
  await page.locator('#carousel-next').click();await opened(ids[1]);await page.waitForTimeout(400);await opened(ids[1]);modes.delete(ids[0]);await close();
  report.checks.push('slow response from previous series cannot replace the current card episodes');
  await page.goto('http://127.0.0.1:8789/?movie='+ids[1],{waitUntil:'domcontentloaded'});await opened(ids[1]);
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.unexpectedWrites,[]);report.metadataRequests=calls.length;report.pass=true;
  report.checks.push('deep-linked series uses the same hierarchy; zero source-resolution, playback or account writes');
  await page.screenshot({path:path.join(output,'all-series-entry-paths.png')});
 }catch(e){report.pass=false;report.error=e.stack;await page.screenshot({path:path.join(output,'all-series-failure.png')}).catch(()=>{});}
 finally{await ctx.close();console.log(JSON.stringify(report));}
 return report;
}

(async()=>{
 if(process.env.MOVIE_NIGHT_VERIFY_SERVED){
  const identities=[];
  for(const file of ['app.js','index.html','style.css']){
   const expected=fs.readFileSync(path.join(root,'web',file));
   const response=await fetch('http://127.0.0.1:8789/'+file,{cache:'no-store'});
   assert.equal(response.status,200);const received=Buffer.from(await response.arrayBuffer());
   const digest=b=>createHash('sha256').update(b).digest('hex');
   identities.push({file,expected:digest(expected),served:digest(received),matches:expected.equals(received)});
  }
  fs.writeFileSync(path.join(output,'served-generation.json'),JSON.stringify(identities,null,2));
  assert.ok(identities.every(x=>x.matches),'ARIES_SERVED_GENERATION_MISMATCH: source tests cannot qualify old served files');
 }
 const browser=await chromium.launch({executablePath:process.env.MOVIE_NIGHT_CHROME||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});const reports=[];
 try{for(const width of (process.env.MOVIE_NIGHT_ALL_SERIES_ONLY ? [] : [390,768,1280])){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
  const report={width,checks:[],requests:[],errors:[],unexpectedWrites:[],proof:'BROWSER_WITH_SYNTHETIC_PROVIDER_AND_PLAYER',realPlayback:false};reports.push(report);
  const page=await context.newPage();page.setDefaultTimeout(9000);page.on('pageerror',e=>report.errors.push(e.message));
  let current={state:'idle',imdb_id:'',type:'movie',title:'',duration:0,position:0,volume:60},wrong=false,delay=0;
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());if(u.origin!=='http://127.0.0.1:8789')return route.abort();
   const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   if(u.pathname.startsWith('/api/player/')){
    const body=req.method()==='POST'?req.postDataJSON():null;report.requests.push({path:u.pathname,body});
    if(u.pathname.endsWith('/status'))return reply(current);
    if(u.pathname.endsWith('/sources')){
     if(delay)await new Promise(r=>setTimeout(r,delay));
     return reply({...body,video_id:body.type==='series'?`${body.imdb_id}:${body.season}:${body.episode}`:body.imdb_id,episode:wrong?99:body.episode,
       sources:Array.from({length:15},(_,i)=>({id:`fixture_source_${String(i).padStart(2,'0')}_abcdefghijklmno`,quality:'1080p',label:`1080p source ${i+1}`,video_codec:i%2?'AVC / H.264':'HEVC / H.265',source_format:'WEB-DL',container:'MKV',languages:i%2?['French']:['English'],audio:['DD+','5.1'],size_bytes:(i+1)*1073741824}))});
    }
    if(u.pathname.endsWith('/play')){current={...current,...body,state:'playing',duration:1500,position:0};return reply(current,202);}
    return reply({error:'forbidden_in_test'},403);
   }
   if(req.method()!=='GET'){report.unexpectedWrites.push(u.pathname);return reply({error:'Test blocks writes'},403);}
   if(u.pathname==='/api/personal-library')return reply({favorites:[series],recent:[],watched:[],collections:[],imported_at:null});
   if(u.pathname==='/api/browse/meta')return reply({movie:{...series,episodes},source:'fixture'});
   const rel=u.pathname==='/'?'index.html':u.pathname.slice(1);const file=path.resolve(root,'web',rel);
   if(!process.env.MOVIE_NIGHT_VERIFY_SERVED&&file.startsWith(path.resolve(root,'web')+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({contentType:({'.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.html':'text/html'})[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
   return route.continue();
  });
  try{
   await page.goto('http://127.0.0.1:8789/',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.getElementById('favorite-count')?.textContent === '1' && document.querySelectorAll('.movie-card').length>0);
   await page.locator('[data-collection="personal-favorites"]').click();
   await page.waitForFunction(()=>document.getElementById('collection-title')?.textContent === 'The ones you love.');
   await page.getByRole('button',{name:/^View details: Episode identity fixture/}).click();
   await page.locator('#episode-list button').first().waitFor();
   assert.equal(await page.locator('#play-on-aries').isDisabled(),true);
   assert.equal(report.requests.filter(x=>x.path.endsWith('/sources')||x.path.endsWith('/play')).length,0);
   report.checks.push('title/season selection has no resolution/play effect; episode required');
   await page.locator('#episode-list button').nth(1).click();
   assert.ok((await page.locator('#episode-selection').innerText()).includes('S01 E02'));
   current={...current,state:'paused',imdb_id:series.id,type:'series',season:1,episode:1,title:series.title};await page.waitForTimeout(2100);
   await page.locator('#play-on-aries').click();await page.locator('#source-list input').first().waitFor();
   assert.equal(report.requests.filter(x=>x.path.endsWith('/command')).length,0,'different episode must not resume the old episode');
   assert.equal(report.requests.filter(x=>x.path.endsWith('/sources')).at(-1).body.episode,2);
   assert.ok((await page.locator('#source-heading').innerText()).includes('S01 E02'));
   assert.ok((await page.locator('#source-list').innerText()).includes('English'));
   assert.ok((await page.locator('#source-list').innerText()).includes('HEVC'));
   assert.equal(await page.locator('.source-row-play').count(),15);
   const bar=await page.locator('.source-action-bar').boundingBox(),first=await page.locator('.source-option').first().boundingBox();assert.ok(bar.y<first.y,'Play bar is after the list');
   await page.locator('#source-list input').first().check();assert.equal(report.requests.filter(x=>x.path.endsWith('/play')).length,0);
   report.checks.push('exact episode request; a different paused episode is not resumed; differentiating source details; selection does not play');
   await page.locator('#source-list input').first().focus();await page.keyboard.press('ArrowDown');
   assert.equal(report.requests.filter(x=>x.path.endsWith('/play')).length,0,'radio navigation triggered playback');
   await page.locator('.source-option').last().scrollIntoViewIfNeeded();
   const sticky=await page.locator('.source-action-bar').boundingBox();assert.ok(sticky.y>=0&&sticky.y+sticky.height<=900,'selected-source Play disappeared while browsing sources');
   report.checks.push('keyboard source selection does not play; Play stays reachable while scrolling the list');
   await page.locator('#episode-season').selectOption('0');
   assert.equal(await page.locator('#source-picker').isVisible(),false);
   assert.equal(await page.locator('#play-on-aries').isDisabled(),true);
   await page.locator('#episode-list button').first().click();
   await page.locator('#choose-sources').click();await page.locator('#source-list input').first().waitFor();
   assert.equal(report.requests.filter(x=>x.path.endsWith('/sources')).at(-1).body.season,0);
   await page.locator('.source-row-play').first().click();await page.locator('#film-dialog').waitFor({state:'hidden'});
   const played=report.requests.filter(x=>x.path.endsWith('/play'));assert.equal(played.length,1);assert.equal(played[0].body.type,'series');assert.equal(played[0].body.season,0);assert.equal(played[0].body.episode,1);
   report.checks.push('season change clears prior stream; specials remain season zero; explicit row action emits one exact episode play request');
   current={...current,state:'idle',imdb_id:'',title:''};await page.waitForTimeout(2100);
   await page.getByRole('button',{name:/^View details: Episode identity fixture/}).click();await page.locator('#episode-list button').first().waitFor();
   await page.locator('#episode-list button').first().click();wrong=true;
   await page.locator('#choose-sources').click();await page.waitForFunction(()=>document.getElementById('source-status').textContent.includes('do not match'));
   assert.equal(await page.locator('#source-list input').count(),0);assert.equal(await page.locator('#play-source').isDisabled(),true);assert.equal(report.requests.filter(x=>x.path.endsWith('/play')).length,1);
   report.checks.push('wrong episode response rejected without fallback or extra playback');
   wrong=false;delay=350;await page.locator('#refresh-sources').click();await page.locator('#episode-season').selectOption('0');await page.waitForTimeout(500);
   assert.equal(await page.locator('#source-picker').isVisible(),false);assert.equal(await page.locator('#source-list input').count(),0);
   report.checks.push('stale source reply discarded after season change');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.deepEqual(report.errors,[]);assert.deepEqual(report.unexpectedWrites,[]);
   await page.screenshot({path:path.join(output,`episodes-${width}.png`)});report.pass=true;
  }catch(e){report.pass=false;report.error=e.stack;await page.screenshot({path:path.join(output,`failure-${width}.png`)}).catch(()=>{});}
  finally{await context.close();console.log(JSON.stringify(report));}
 }
 reports.push(await verifyAllSeries(browser,output));
 }finally{await browser.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(reports,null,2));}
 process.exitCode=reports.every(r=>r.pass)?0:1;
})().catch(e=>{console.error(e);process.exitCode=1});

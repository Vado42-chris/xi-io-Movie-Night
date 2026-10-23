'use strict';
// No real media, native host, provider, saved library, AI call or application window.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.MOVIE_NIGHT_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]),base='http://127.0.0.1:8789';
const fixture=JSON.parse(fs.readFileSync(process.env.MOVIE_NIGHT_HOME_FIXTURE));const reports=[];
const art='https://fixture.example/art.svg';
const films=Array.from({length:16},(_,i)=>({id:'tt'+(8401000+i),imdb_id:'tt'+(8401000+i),type:'movie',title:`Fixture film ${i+1}`,year:2010+i%8,genres:['Adventure','Western'],poster:art,description:'A short synthetic synopsis for a manual UI journey.',runtime:'102 min'}));
const show={...films[0],id:'tt8402000',imdb_id:'tt8402000',type:'series',title:'Fixture series'};
const episodes=[1,2,3].map(n=>({id:show.id+':1:'+n,season:1,episode:n,title:'Episode '+n,released:'2020-01-01',overview:'SPOILER_SENTINEL',thumbnail:art}));
const recent=[{...show,season:1,episode:2,lastPositionMs:120000,durationMs:2400000,lastUpdatedEpochMs:200}, {...films[0],lastPositionMs:600000,durationMs:6000000,lastUpdatedEpochMs:100}, {...films[1],lastPositionMs:6000000,durationMs:6000000,isCompleted:true}, {...films[2],lastPositionMs:0,durationMs:6000000}, {...show,id:'tt8402000:1:3',season:1,episode:2,lastPositionMs:1000,durationMs:30000}];
const sourceID='synthetic_title_bound_source_000001';
async function make(browser,width,mode='normal'){
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(6000);
 const calls={sources:[],plays:[],commands:[],writes:[],ai:0,errors:[],meta:0};let status={state:'idle',imdb_id:'',type:'movie',volume:50};
 page.on('pageerror',e=>calls.errors.push(e.message));
 await context.route('**/*',async route=>{const req=route.request(),u=new URL(req.url()),reply=(x,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(x)}).catch(()=>{});
 if(u.hostname==='fixture.example')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><rect width="300" height="450" fill="#405165"/><text x="30" y="220" fill="white" font-size="30">TEST ART</text></svg>'});
 if(u.origin!==base)return route.abort();
 if(u.pathname.startsWith('/api/ai-')||u.pathname.startsWith('/api/concierge')){calls.ai++;return reply({error:'AI disabled'},503);}
 if(u.pathname==='/api/player/status')return reply(status);
 if(req.method()==='POST'&&u.pathname.startsWith('/api/player/')){
  const b=req.postDataJSON();
  if(u.pathname.endsWith('/sources')){calls.sources.push(b);if(mode==='source-denied')return reply({error:'source_unavailable'},403);return reply({...b,imdb_id:mode==='wrong-source'?'tt9999999':b.imdb_id,sources:[{id:sourceID,label:'Verified fixture source',quality:'1080p'}]});}
  if(u.pathname.endsWith('/play')){calls.plays.push(b);if(mode==='play-failed')return reply({error:'source_expired'},409);if(mode==='wrong-playing')return reply({...b,state:'playing',imdb_id:'tt9999999',volume:50});status={...b,state:'playing',volume:50};return reply(status);}
  if(u.pathname.endsWith('/command')){calls.commands.push(b);status.state='idle';return reply(status);}
 }
 if(req.method()!=='GET'){calls.writes.push(u.pathname);return reply({error:'test refuses writes'},403);}
 if(u.pathname==='/api/settings/declaration')return reply(fixture.declaration);
 if(u.pathname==='/api/settings')return reply(fixture.settings);
 if(u.pathname==='/api/filter-cubes/declaration')return reply(fixture.cubeDeclaration);
 if(u.pathname==='/api/filter-cubes')return reply(fixture.cubes);
 if(u.pathname==='/api/catalogues')return reply({catalogues:[]});
 if(u.pathname==='/api/library.json')return reply({title:'Movie Night',collections:[{id:'fixture-shelf',name:'Fixture shelf',movies:films}]});
 if(u.pathname==='/api/personal-library'){
  if(mode==='library-denied')return reply({error:'not authorized'},403);
  return reply({favorites:[films[3]],recent:mode==='no-history'?[]:recent,watched:[films[1].id],collections:[{id:'nuvio-library',name:'Fixture library',movies:[...films,show]}],imported_at:null});
 }
 if(u.pathname==='/api/browse'){return reply({movies:u.searchParams.get('type')==='series'?[show]:films,has_more:false,next_skip:null,source:'Cinemeta'});}
 if(u.pathname==='/api/browse/meta'){
  calls.meta++;if(mode==='meta-denied')return reply({error:'metadata unavailable'},503);
  if(mode==='slow-meta')await new Promise(resolve=>setTimeout(resolve,700));
  const id=u.searchParams.get('id'),movie=id===show.id?{...show,episodes}:films.find(f=>f.id===id);return reply({movie});
 }
 if(u.pathname.startsWith('/api/')){calls.errors.push('Unexpected API '+u.pathname);return reply({error:'unexpected'},403);}
 const rel=u.pathname==='/'?'index.html':u.pathname.slice(1),p=path.resolve(root,'web',rel);
 if(!p.startsWith(path.join(root,'web')+path.sep)||!fs.existsSync(p))return route.abort();
 return route.fulfill({body:fs.readFileSync(p),contentType:({'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript'})[path.extname(p)]||'application/octet-stream'});
 });
 await page.goto(base+'/',{waitUntil:'domcontentloaded'});await page.locator('[data-experience-tab=home]').waitFor();await page.locator('.cube-row .cube-cover').first().waitFor();
 return {page,context,calls,async close(){await context.close()},async sourcePlay(){await page.locator('.source-row-play').first().click();},async recentRoute(){await page.locator('[data-experience-tab=library]').click();await page.locator('[data-collection=personal-recent]').click();await page.locator('#film-grid .movie-card').filter({hasText:'Fixture series'}).first().click();await page.locator('[data-episode-id="tt8402000:1:2"][aria-pressed=true]').waitFor();}};
}
async function test(browser,width,name,mode,fn){const r={width,name,pass:false,fixture:true};let s;
 try{s=await make(browser,width,mode);await fn(s,r);assert.deepEqual(s.calls.errors,[]);assert.deepEqual(s.calls.writes,[]);assert.equal(s.calls.ai,0);r.pass=true;}
 catch(e){r.error=String(e).slice(0,1300);if(s)await s.page.screenshot({path:path.join(out,`${name}-${width}-failure.png`)}).catch(()=>{});}
 finally{if(s)await s.close();reports.push(r);console.log(JSON.stringify(r));}}
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:process.env.MOVIE_NIGHT_CHROME||'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
try{for(const width of (process.env.MOVIE_NIGHT_TEST_WIDTHS||'390,768,1280,1920,2560').split(',').map(Number)){
 await test(browser,width,'movie-actions-and-hierarchy','normal',async(s,r)=>{
  let clicks=0;const rail=s.page.locator('.cube-row.experience-featured').first();const next=rail.locator('.cube-cover[data-index="1"]');await next.click();clicks++;
  if(await s.page.locator('#film-dialog').isHidden()){await rail.locator('.cube-cover[aria-current=true]').click();clicks++;}
  await s.page.locator('#dialog-title').waitFor();assert.equal(s.calls.sources.length,0);assert.equal(s.calls.plays.length,0);
  const image=await s.page.locator('#dialog-poster').boundingBox(),track=await s.page.locator('#carousel-cards').boundingBox();r.artworkFits=image.width<=track.width+2;const box=await s.page.locator('#play-on-aries').boundingBox();r.watchY=box.y;r.watchHeight=box.height;r.watchAboveFold=box.y>=0&&box.y+box.height<=900;await s.page.screenshot({path:path.join(out,'detail-'+width+'.png')});
  await s.page.locator('#play-on-aries').click();clicks++;await s.page.locator('.source-row-play').first().waitFor();assert.equal(s.calls.plays.length,0);
  await s.sourcePlay();clicks++;await s.page.waitForFunction(()=>document.querySelector('#player-dock').dataset.state==='playing');
  r.actionsToPlay=clicks;assert.equal(s.calls.plays.length,1);assert.ok(r.watchAboveFold,'Watch is below first detail viewport');assert.ok(r.artworkFits,'selected artwork clipped by narrow column');assert.ok(clicks<=3,'off-centre poster requires an extra click');
 });
 await test(browser,width,'resume-saved-episode','normal',async(s,r)=>{
  let clicks=0;const resume=s.page.locator('[data-resume-media="series:tt8402000:1:2"]');
  if(await resume.count()){await resume.click();clicks++;}else{await s.recentRoute();clicks+=3;await s.page.locator('#play-on-aries').click();clicks++;}
  await s.page.locator('.source-row-play').first().waitFor();assert.equal(s.calls.plays.length,0);assert.equal(s.calls.sources.at(-1).season,1);assert.equal(s.calls.sources.at(-1).episode,2);
  await s.sourcePlay();clicks++;await s.page.waitForFunction(()=>document.querySelector('#player-dock').dataset.state==='playing');r.actionsToPlay=clicks;assert.equal(s.calls.plays.length,1);assert.equal(s.calls.plays[0].episode,2);assert.equal(clicks,2);
 });
 await test(browser,width,'home-content-and-sizing','normal',async(s,r)=>{
  const count=await s.page.locator('[data-resume-media]').count();r.resumeChoices=count;const earlyRail=await s.page.locator('.cube-row.experience-featured').first().boundingBox();r.railHeight=earlyRail.height;assert.equal(count,2,'only exact unfinished records should be projected');
  assert.ok(await s.page.locator('#home-bin-links button').count()>=3);assert.ok(await s.page.locator('#home-genres button').count()>=5);
  const rail=s.page.locator('.cube-row.experience-featured').first(),b=await rail.boundingBox();r.railHeight=b.height;
  assert.ok(b.height<480,'Home rail remains oversized');
  assert.equal(await s.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  await s.page.screenshot({path:path.join(out,'home-'+width+'.png')});
 });
 }
 for(const mode of ['source-denied','wrong-source','play-failed','wrong-playing']){
 await test(browser,1280,'hostile-'+mode,mode,async(s,r)=>{
  await s.page.locator('[data-experience-tab=library]').click();await s.page.locator('#film-grid .movie-card').first().click();await s.page.locator('#play-on-aries').click();
  if(mode==='play-failed'||mode==='wrong-playing'){await s.page.locator('.source-row-play').first().waitFor();await s.sourcePlay();await s.page.waitForTimeout(200);assert.equal(await s.page.locator('#film-dialog').isVisible(),true);assert.notEqual(await s.page.locator('#player-dock').getAttribute('data-state'),'playing');}
  else{await s.page.waitForTimeout(200);assert.equal(await s.page.locator('.source-row-play').count(),0);assert.equal(s.calls.plays.length,0);}
 });}
 for(const mode of ['no-history','library-denied'])await test(browser,390,'privacy-'+mode,mode,async(s)=>{assert.equal(await s.page.locator('[data-resume-media]').count(),0);assert.equal(s.calls.sources.length,0);assert.equal(s.calls.plays.length,0);assert.equal(await s.page.locator('#film-search').isVisible(),true);});
 await test(browser,1280,'resume-cancel-during-metadata','slow-meta',async(s)=>{const resume=s.page.locator('[data-resume-media="series:tt8402000:1:2"]');assert.equal(await resume.count(),1);await resume.click();await s.page.locator('#close-dialog').click();await s.page.waitForTimeout(850);assert.equal(s.calls.sources.length,0);assert.equal(s.calls.plays.length,0);});
 await test(browser,390,'metadata-failure-preserves-episode','meta-denied',async(s)=>{const b=s.page.locator('[data-resume-media="series:tt8402000:1:2"]');assert.equal(await b.count(),1);await b.click();await s.page.waitForTimeout(100);assert.equal(s.calls.sources.length,0);assert.equal(s.calls.plays.length,0);assert.equal(await s.page.locator('#play-on-aries').isDisabled(),true);assert.equal(await s.page.locator('#play-on-aries-label').innerText(),'Episodes unavailable');});
 await test(browser,768,'double-watch-single-lookup','normal',async(s)=>{await s.page.locator('[data-experience-tab=library]').click();await s.page.locator('#film-grid .movie-card').first().click();await s.page.locator('#play-on-aries').dblclick({delay:20});await s.page.locator('.source-row-play').first().waitFor();assert.equal(s.calls.plays.length,0);assert.equal(s.calls.sources.length,1);});
 await test(browser,1280,'keyboard-rail-and-back','normal',async(s)=>{const rail=s.page.locator('.cube-row.experience-featured .cube-track').first();await rail.focus();await s.page.keyboard.press('ArrowRight');await s.page.keyboard.press('Enter');await s.page.locator('#dialog-title').waitFor();assert.equal(s.calls.sources.length,0);await s.page.locator('#close-dialog').click();assert.equal(await s.page.evaluate(()=>document.activeElement.classList.contains('cube-track')),true);});
}finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(reports,null,2));}
console.log('HOME_WATCH_TOTAL',JSON.stringify({pass:reports.filter(r=>r.pass).length,fail:reports.filter(r=>!r.pass).length,total:reports.length}));if(reports.some(r=>!r.pass))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});

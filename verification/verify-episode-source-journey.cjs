"use strict";
// Real app code and browser events. Provider metadata/player replies are fixtures.
// No real media is loaded, no personal library or account is changed.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.MOVIE_NIGHT_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..'),output=path.resolve(process.argv[2]);fs.mkdirSync(output,{recursive:true});
const series={id:'tt4798814',imdb_id:'tt4798814',type:'series',title:'Episode identity fixture',year:2016,genres:['Comedy'],description:'Synthetic selection fixture',poster:''};
const episodes=[{id:series.id+':0:1',season:0,episode:1,title:'Special'},...Array.from({length:3},(_,i)=>({id:series.id+':1:'+(i+1),season:1,episode:i+1,title:'Duplicate title',overview:'A fixture, not a playable episode.'}))];
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.MOVIE_NIGHT_CHROME||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});const reports=[];
 try{for(const width of [390,768,1280]){
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
   if(file.startsWith(path.resolve(root,'web')+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({contentType:({'.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.html':'text/html'})[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
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
 }}finally{await browser.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(reports,null,2));}
 process.exitCode=reports.every(r=>r.pass)?0:1;
})().catch(e=>{console.error(e);process.exitCode=1});

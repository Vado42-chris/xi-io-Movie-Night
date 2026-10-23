'use strict';
// Real UI interactions, isolated schemas/data; all API, player and AI traffic
// intercepted. No live library, credentials, models, media or native window.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.MOVIE_NIGHT_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
const fixture=JSON.parse(fs.readFileSync(process.env.MOVIE_NIGHT_DISCOVERY_FIXTURE));
const base='http://127.0.0.1:8789',film={imdb_id:'tt9775360',id:'tt9775360',type:'movie',title:'Batman vs Teenage Mutant Ninja Turtles',year:2019,genres:['Animation'],poster:'https://images.example.test/poster.jpg',description:'Public title identity; synthetic response.'};
const other={...film,id:'tt8400777',imdb_id:'tt8400777',title:'Different query result'};
const series={...film,id:'tt8400778',imdb_id:'tt8400778',type:'series',title:'Synthetic matching series'};
const response=(movies,extra={})=>({movies,has_more:false,next_skip:null,source:'Cinemeta',...extra});
const reports=[];
async function session(browser,width,mode){
 const ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
 const page=await ctx.newPage();page.setDefaultTimeout(4500);
 const state={calls:[],writes:[],errors:[],external:[],recovered:false,release:null};
 page.on('pageerror',e=>state.errors.push(e.message));
 await ctx.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)}).catch(()=>{});
  if(u.hostname==='images.example.test')return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a9sAAAAASUVORK5CYII=','base64')});
  if(u.origin!==base){state.external.push(u.origin);return route.abort();}
  if(req.method()!=='GET'){state.writes.push(u.pathname);return reply({error:'test refuses effects'},403);}
  if(u.pathname==='/api/player/status')return reply({state:'idle',type:'movie',imdb_id:'',title:'',volume:50});
  if(u.pathname==='/api/settings/declaration')return reply(fixture.settingsDeclaration);
  if(u.pathname==='/api/settings')return reply(fixture.settings);
  if(u.pathname==='/api/filter-cubes/declaration')return reply(fixture.cubeDeclaration);
  if(u.pathname==='/api/filter-cubes')return reply(fixture.cubes);
  if(u.pathname==='/api/catalogues')return reply({catalogues:[]});
  if(u.pathname==='/api/library.json')return reply({title:'Movie Night',collections:[{id:'fixture-library',name:'Fixture shelf',movies:[other]}]});
  if(u.pathname==='/api/personal-library')return reply({favorites:[],recent:[],watched:[],collections:[{id:'nuvio-library',name:'Fixture local library',movies:[other]}],imported_at:null});
  if(u.pathname==='/api/browse/meta')return reply({movie:film,source:'Cinemeta'});
  if(u.pathname==='/api/browse'){
   const q=u.searchParams.get('search'),type=u.searchParams.get('type'),skip=Number(u.searchParams.get('skip')||0);
   if(!q)return reply(response(type==='series'?[series]:[other]));
   state.calls.push({q,type,skip});const n=state.calls.filter(x=>x.q===q&&x.type===type).length;
   if(mode==='outage'||mode==='recover-once'&&n===1)return reply({error:'Synthetic provider timeout'},504);
   if(mode==='slow-series'&&type==='series')await new Promise(resolve=>setTimeout(resolve,1800));
   if(mode==='partial'&&type==='series'&&!state.recovered)return reply({error:'Synthetic TV outage'},503);
   if(mode==='race'&&q==='old query'){if(type==='series')return reply(response([]));await new Promise(resolve=>{state.release=resolve});return reply(response([film]));}
   if(mode==='race')return reply(response(type==='movie'?[other]:[]));
   if(mode==='empty')return reply(response([]));
   if(mode==='cached')return reply(response(type==='movie'?[film]:[],{freshness:'stale',stale:true,warning:'Showing cached catalogue results; live refresh is unavailable.'}));
   if(mode==='partial'&&type==='movie')return reply(response([film],{has_more:true,next_skip:skip+100}));
   return reply(response(type==='movie'?[film]:mode==='partial'?[series]:[]));
  }
  if(u.pathname.startsWith('/api/')){state.errors.push('Unexpected API '+u.pathname);return reply({error:'unexpected API'},403);}
  const rel=u.pathname==='/'?'index.html':u.pathname.slice(1),file=path.resolve(root,'web',rel);
  if(!file.startsWith(path.resolve(root,'web')+path.sep)||!fs.existsSync(file)){state.errors.push('Unexpected asset '+u.pathname);return route.abort();}
  return route.fulfill({contentType:({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
 });
 await page.goto(base+'/',{waitUntil:'domcontentloaded'});await page.locator('[data-experience-tab=discover]').click();
 async function query(q='BATMAN VS TEENAGE') {await page.locator('#film-search').fill(q);}
 async function finished(){await page.waitForFunction(()=>document.querySelector('#collection-picker')?.value==='global-results'&&document.querySelector('#film-grid')?.getAttribute('aria-busy')==='false');}
 return {ctx,page,state,query,finished};
}
async function check(browser,width,name,mode,fn){
 let s;const r={name,width,pass:false,provider:'synthetic',native:false};
 try{s=await session(browser,width,mode);await fn(s);assert.deepEqual(s.state.errors,[]);assert.deepEqual(s.state.writes,[]);assert.deepEqual(s.state.external,[]);r.pass=true;r.requestCount=s.state.calls.length;}
 catch(e){r.error=e.stack?.slice(0,1800)||String(e);if(s)await s.page.screenshot({path:path.join(out,`${width}-${name}-failure.png`)}).catch(()=>{});}
 finally{if(s){if(s.state.release)s.state.release();await s.ctx.close();}reports.push(r);console.log(JSON.stringify(r));}
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.MOVIE_NIGHT_CHROME||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{for(const width of [390,1280]){
 await check(browser,width,'exact-title','normal',async s=>{await s.query();await s.finished();const card=s.page.locator('#film-grid .movie-card').filter({hasText:film.title});assert.equal(await card.count(),1);await card.click();await s.page.waitForFunction(()=>document.querySelector('#dialog-title')?.textContent==='Batman vs Teenage Mutant Ninja Turtles');assert.equal(await s.page.locator('#dialog-poster img').getAttribute('src'),film.poster);assert.equal(s.state.writes.length,0);});
 await check(browser,width,'query-not-filter','normal',async s=>{await s.query();await s.finished();assert.equal(await s.page.locator('#filter-count').isVisible(),false);assert.equal(await s.page.locator('#clear-filters').isVisible(),false);});
 await check(browser,width,'outage-is-not-empty','outage',async s=>{await s.query();await s.finished();assert.equal(await s.page.locator('#empty-title').innerText(),'Search is unavailable');assert.equal(await s.page.locator('#empty-reset').isVisible(),false);assert.equal(await s.page.locator('#load-more').innerText(),'Retry search');assert.equal(s.state.calls.length,4,'at most one recovery GET per failed type');assert.equal(await s.page.locator('#film-search').inputValue(),'BATMAN VS TEENAGE');});
 await check(browser,width,'bounded-transient-recovery','recover-once',async s=>{await s.query();await s.finished();assert.equal(await s.page.locator('#film-grid .movie-card').count(),1);assert.equal(s.state.calls.length,4);});
 await check(browser,width,'movies-before-slow-tv','slow-series',async s=>{await s.query();await s.page.locator('#film-grid .movie-card').filter({hasText:film.title}).waitFor({timeout:1200});assert.equal(await s.page.locator('#film-grid').getAttribute('aria-busy'),'true');await s.finished();});
 await check(browser,width,'retry-only-failed-type','partial',async s=>{await s.query();await s.finished();assert.equal(await s.page.locator('#film-grid .movie-card').count(),1);const before=s.state.calls.filter(x=>x.type==='movie').length;s.state.recovered=true;await s.page.locator('#load-more').click();await s.finished();assert.equal(s.state.calls.filter(x=>x.type==='movie').length,before,'retry advanced successful movie cursor');assert.equal(await s.page.locator('#film-grid .movie-card').count(),2);});
 await check(browser,width,'superseded-query','race',async s=>{await s.query('old query');for(let n=0;n<30&&!s.state.release;n++)await s.page.waitForTimeout(30);assert.ok(s.state.release);await s.query('different');s.state.release();await s.page.waitForTimeout(100);assert.equal(await s.page.locator('#film-grid .movie-card').filter({hasText:film.title}).count(),0,'old query painted during new debounce');await s.finished();});
 await check(browser,width,'empty-not-outage','empty',async s=>{await s.query();await s.finished();assert.equal(await s.page.locator('#empty-title').innerText(),'No titles found for this search');assert.equal(await s.page.locator('#load-more').isVisible(),false);assert.equal(s.state.calls.length,2);});
 await check(browser,width,'cached-results-disclosed','cached',async s=>{await s.query();await s.finished();assert.equal(await s.page.locator('#film-grid .movie-card').count(),1);assert.match(await s.page.locator('#browse-feedback').innerText(),/cached/i);});
 }}finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(reports,null,2));}
 console.log('DISCOVERY_REPLAY',JSON.stringify({pass:reports.filter(x=>x.pass).length,fail:reports.filter(x=>!x.pass).length,total:reports.length}));if(reports.some(x=>!x.pass))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});

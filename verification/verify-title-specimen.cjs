"use strict";
// Browser-only source checks. Every request is intercepted; no real services, user data or playback.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.MOVIE_NIGHT_PLAYWRIGHT||'/media/chrishallberg/Storage 22/999_Work/003_Projects/017_xi-io_inbox/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
const origin='http://127.0.0.1:8789';
const schema=JSON.parse(fs.readFileSync(path.join(root,'xiio/settings.schema.json'),'utf8'));
const defaults=n=>n.type==='object'?Object.fromEntries(Object.entries(n.properties).map(([k,v])=>[k,defaults(v)])):n.default;
const movies=JSON.parse(fs.readFileSync(path.join(root,'data/top100-1980-1995.json'),'utf8'));
const results=[];
async function setup(browser,width){
 const ctx=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce',serviceWorkers:'block'});
 const page=await ctx.newPage();page.setDefaultTimeout(10000);const state={writes:[],unexpected:[],errors:[]};
 page.on('pageerror',e=>state.errors.push(e.message));
 await ctx.route('**/*',async route=>{
  const request=route.request(),u=new URL(request.url());
  if(request.method()!=='GET'){state.writes.push(u.pathname);return route.abort();}
  if(u.origin!==origin)return route.abort();
  const json=data=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  if(u.pathname==='/api/library.json')return json({title:'Movie Night',collections:[{id:'top100-1980-1995',name:'Top 100',movies}]});
  if(u.pathname==='/api/settings')return json({revision:0,settings:defaults(schema)});
  if(u.pathname==='/api/settings/declaration')return json(schema);
  if(u.pathname==='/api/filter-cubes')return json({schema:'movie-night.filter-cubes/v1',revision:0,view:'wall',selected_id:null,rows:[]});
  if(u.pathname==='/api/personal-library')return json({favorites:[],recent:[],watched:[],collections:[],imported_at:null});
  if(u.pathname==='/api/catalogues')return json({catalogues:[]});
  if(u.pathname==='/api/player/status')return json({state:'idle',title:'',imdb_id:'',volume:50});
  if(u.pathname==='/api/browse/meta'){
   const movie=movies.find(m=>m.imdb_id===u.searchParams.get('id'));
   return json({movie:{...movie,type:'movie',cast:[],director:[]},source:'fixture'});
  }
  const assets={'/':'web/index.html','/index.html':'web/index.html','/app.js':'web/app.js','/style.css':'web/style.css','/filter-cubes.css':'web/filter-cubes.css','/filter-cubes.mjs':'web/filter-cubes.mjs','/settings-contract.mjs':'web/settings-contract.mjs','/native-appearance.css':'web/native-appearance.css'};
  const name=u.pathname.split('/').pop();
  const relative=assets[u.pathname]||(/^title-detail-specimen\.(html|css|mjs)$/.test(name)?`verification/specimens/${name}`:null);
  if(relative){const type=relative.endsWith('.html')?'text/html':relative.endsWith('.css')?'text/css':'text/javascript';return route.fulfill({contentType:type,body:fs.readFileSync(path.join(root,relative))});}
  if(u.pathname==='/favicon.ico')return route.fulfill({status:204,body:''});
  state.unexpected.push(u.pathname);return route.abort();
 });
 return{ctx,page,state};
}
async function widthMetrics(page){return page.evaluate(()=>{
 const content=document.querySelector('.detail-content'),track=document.querySelector('#carousel-cards');
 const box=content.getBoundingClientRect(),style=getComputedStyle(content),t=track.getBoundingClientRect();
 const selected=track.querySelector('[aria-current=true]').getBoundingClientRect();
 return{viewport:innerWidth,content:box.width,track:t.width,usable:box.width-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight),centerError:Math.abs((selected.left+selected.width/2)-(t.left+t.width/2)),overflow:document.documentElement.scrollWidth-innerWidth};
});}
(async()=>{
const browser=await chromium.launch({executablePath:process.env.MOVIE_NIGHT_CHROME||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{for(const width of [2560,1920,1280,768,390,320]){
 const {ctx,page,state}=await setup(browser,width);const result={width,pass:false};results.push(result);
 try{
  await page.goto(origin,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelectorAll('.movie-card').length===100);
  await page.locator('.movie-card').first().click();await page.locator('#carousel-cards.cube-track').waitFor();
  const metrics=await widthMetrics(page);assert.ok(Math.abs(metrics.track-metrics.usable)<3,JSON.stringify(metrics));assert.ok(metrics.centerError<2);assert.ok(metrics.overflow<=2);
  assert.ok(await page.locator('#detail-related').isVisible(),'Recommendations must be outside More details');assert.equal(await page.locator('#detail-expanded').isVisible(),false);
  assert.ok(await page.locator('#related-titles button').count()>0);const title=await page.locator('#dialog-title').textContent();
  await page.locator('#related-titles button').first().click();assert.notEqual(await page.locator('#dialog-title').textContent(),title);
  await page.locator('#film-search').fill('NO_RESULT_TITLE_XXXXX');assert.equal(await page.locator('#detail-related').isVisible(),false,'Do not retain previous title recommendations on empty selection');
  await page.locator('#carousel-reset').click();await page.locator('#detail-related').waitFor();
  await page.screenshot({path:path.join(out,`content-${width}.png`)});
  result.layout=metrics;
  await page.goto(origin+'/studio/assets/title-detail-specimen.html',{waitUntil:'domcontentloaded'});await page.locator('#episode-rows button').first().waitFor();
  const specimen=await widthMetrics(page);assert.ok(Math.abs(specimen.track-specimen.usable)<3);assert.ok(specimen.centerError<2);assert.ok(specimen.overflow<=2);
  await page.locator('#specimen-season').selectOption('2');const episode=page.locator('#episode-rows button').nth(2);await episode.focus();await page.keyboard.press('Enter');
  assert.equal(await episode.getAttribute('aria-pressed'),'true');assert.match(await page.locator('#episode-selected').textContent(),/Season 2, episode 3/);assert.equal(await page.locator('#episode-play').isDisabled(),true);
  await page.locator('#specimen-next').click();assert.equal(await page.locator('#episode-selected').textContent(),'No episode selected','Series change clears old episode identity');
  await page.locator('#specimen-season').selectOption('0');assert.equal(await page.locator('#episode-rows button').count(),2);
  for(const status of ['loading','empty','error']){await page.locator('#specimen-state').selectOption(status);assert.equal(await page.locator('#episode-rows button').count(),0);assert.equal(await page.locator('#episode-play').isDisabled(),true);}
  await page.locator('#specimen-state').selectOption('ready');await page.locator('#specimen-season').selectOption('1');
  await page.screenshot({path:path.join(out,`series-specimen-${width}.png`),fullPage:true});
  await page.locator('#specimen-kind').selectOption('movie');assert.equal(await page.locator('#specimen-episodes').isVisible(),false);assert.ok(await page.locator('#specimen-recommendations').isVisible());assert.equal(await page.locator('#recommendation-rows button').count(),8);
  const rec=page.locator('#recommendation-rows button').first();await rec.focus();await page.keyboard.press('Enter');assert.ok(await page.locator('#specimen-title').evaluate(e=>e===document.activeElement));
  for(const status of ['empty','error','loading']){await page.locator('#specimen-state').selectOption(status);assert.equal(await page.locator('#recommendation-rows button').count(),0);}
  await page.locator('#specimen-state').selectOption('ready');await page.screenshot({path:path.join(out,`movie-specimen-${width}.png`),fullPage:true});
  assert.deepEqual(state.writes,[]);assert.deepEqual(state.unexpected,[]);assert.deepEqual(state.errors,[]);
  result.pass=true;result.checks=['full content width','selected cover truly centred','no page overflow','recommendations visible without expanding credits','recommendation navigation','empty-selection clears recommendations','season/specials and keyboard selection','changing series clears episode','loading/empty/error states','unbound media controls disabled','no real network or writes'];
 }catch(e){result.error=e.message;result.pageErrors=state.errors;await page.screenshot({path:path.join(out,`failure-${width}.png`),fullPage:true}).catch(()=>{});}
 await ctx.close();
}}finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({pass:results.every(x=>x.pass),proof:'isolated browser source rendering, not installed playback',results},null,2));console.log(JSON.stringify(results,null,2));}
if(results.some(x=>!x.pass))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});

'use strict';
// Isolated browser data. No account, playback, library or preference writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.MOVIE_NIGHT_PLAYWRIGHT||'/media/chrishallberg/Storage 22/999_Work/003_Projects/017_xi-io_inbox/node_modules/playwright');
const root=path.resolve(__dirname,'..'),base=process.env.MOVIE_NIGHT_URL||'http://127.0.0.1:8789';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const output=path.resolve(process.argv[2]);fs.mkdirSync(output,{recursive:true});
const movies=JSON.parse(fs.readFileSync(path.join(root,'data/top100-1980-1995.json'),'utf8'));
const schema=JSON.parse(fs.readFileSync(path.join(root,'xiio/settings.schema.json'),'utf8'));
const defaults=n=>n.type==='object'?Object.fromEntries(Object.entries(n.properties).map(([k,v])=>[k,defaults(v)])):n.default;
const imported=[...movies.slice(0,2).map(m=>({...m,id:m.imdb_id,type:'movie'})),{id:'tt9999999',type:'series',title:'Provider Series Fixture',genres:['Drama'],year:2020}];
const library={favorites:imported.slice(0,1),recent:[],watched:[],collections:[{id:'nuvio-library',name:'Nuvio library',movies:imported}],imported_at:'2026-10-21T12:00:00Z'};
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});const results=[];
try{for(const v of [{width:1440,height:1000},{width:768,height:1024},{width:430,height:900}]){
const ctx=await browser.newContext({viewport:v,reducedMotion:'reduce',serviceWorkers:'block'}),page=await ctx.newPage();page.setDefaultTimeout(10000);let writes=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
await ctx.route('**/api/**',async r=>{const u=new URL(r.request().url());if(r.request().method()!=='GET'){writes++;return r.abort();}
let body;if(u.pathname==='/api/settings')body={revision:0,settings:defaults(schema)};else if(u.pathname==='/api/personal-library')body=library;else if(u.pathname.startsWith('/api/player/'))body={state:'idle',volume:50};else if(u.pathname==='/api/browse/meta')body={movie:{},source:'fixture'};
return body?r.fulfill({contentType:'application/json',body:JSON.stringify(body)}):r.continue();});
try{
await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelectorAll('.movie-card').length===100);
assert.equal(await page.locator('[data-collection="nuvio-library"]').count(),0);
await page.locator('#provider-filter').selectOption('nuvio');assert.equal(await page.locator('.movie-card').count(),2);
await page.locator('[data-collection="library"]').click();assert.equal(await page.locator('.movie-card').count(),3);assert.equal(await page.locator('#collection-title').textContent(),'Your library');
await page.locator('#open-filters').click();await page.locator('#filter-type').selectOption('series');await page.locator('#apply-filters').click();assert.equal(await page.locator('.movie-card').count(),1);
await page.locator('.movie-card').click();assert.equal(await page.locator('#detail-filter-controls #provider-filter').inputValue(),'nuvio');
await page.getByRole('button',{name:'Remove filter: Provider: Nuvio'}).click();assert.equal(await page.locator('#provider-filter').inputValue(),'');assert.ok((await page.locator('#carousel-counter').textContent()).includes('1 matching'));
await page.locator('#close-dialog').click();await page.locator('#clear-filters').click();assert.equal(await page.locator('.movie-card').count(),3);
await page.locator('#provider-filter').selectOption('nuvio');await page.locator('#open-filters').click();await page.locator('#saved-view-name').fill('Nuvio source cube');await page.locator('#save-view').click();await page.locator('#close-filters').click();
await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelectorAll('.movie-card').length===100);
await page.locator('#open-filters').click();await page.locator('#saved-views').selectOption('0');await page.locator('#apply-filters').click();assert.equal(await page.locator('#provider-filter').inputValue(),'nuvio');assert.equal(await page.locator('.movie-card').count(),3);
for(const id of ['youtube','prime','netflix','disney'])assert.equal(await page.locator(`#provider-filter option[value="${id}"]`).isDisabled(),true);
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);assert.equal(writes,0);assert.deepEqual(errors,[]);
await page.screenshot({path:path.join(output,`provider-${v.width}.png`)});results.push({width:v.width,pass:true,checks:['provider independent of category/type','source membership intersection','same filter in detail carousel','saved-filter reload','unconnected services disabled','no overflow','no writes']});
}catch(e){results.push({width:v.width,pass:false,error:e.message,errors});await page.screenshot({path:path.join(output,`failure-${v.width}.png`)}).catch(()=>{});}await ctx.close();
}}finally{await browser.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));}if(results.some(r=>!r.pass))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});

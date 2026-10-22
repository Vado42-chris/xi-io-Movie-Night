"use strict";
// Isolated browser contexts and intercepted media routes. No real playback or user-file writes.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.MOVIE_NIGHT_PLAYWRIGHT || '/media/chrishallberg/Storage 22/999_Work/003_Projects/017_xi-io_inbox/node_modules/playwright');
const base = process.env.MOVIE_NIGHT_URL;
assert.ok(base && ['127.0.0.1','localhost'].includes(new URL(base).hostname));
const out = path.resolve(process.argv[2]); fs.mkdirSync(out,{recursive:true});
const movies = JSON.parse(fs.readFileSync(path.join(__dirname,'../data/top100-1980-1995.json'),'utf8'));
const results=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try {
  for(const v of [{name:'desktop',width:1440,height:1000},{name:'tablet',width:768,height:1024},{name:'phone',width:430,height:900}]){
   const ctx=await browser.newContext({viewport:v,reducedMotion:'reduce',serviceWorkers:'block'});
   const page=await ctx.newPage();page.setDefaultTimeout(10000);
   const result={viewport:v.name,pass:false,checks:[],errors:[],playerWrites:0}; results.push(result);
   page.on('pageerror',e=>result.errors.push(e.message));
   await ctx.route('**/api/personal-library**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({favorites:[],recent:[],watched:[],collections:[],imported_at:null})}));
   await ctx.route('**/api/player/**',route=>{
    if(route.request().method()==='POST')result.playerWrites++;
    return route.fulfill({contentType:'application/json',body:JSON.stringify({state:'idle',imdb_id:'',title:'',volume:50})});
   });
   await ctx.route('**/api/browse/meta?**',route=>{
    const id=new URL(route.request().url()).searchParams.get('id');const row=movies.find(m=>m.imdb_id===id);
    return route.fulfill({contentType:'application/json',body:JSON.stringify({movie:{...row,type:'movie',cast:['Test actor'],director:['Test director'],background:''},source:'Cinemeta'})});
   });
   try {
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelectorAll('.movie-card').length===100);
    await page.evaluate(()=>{window.originalFilterNode=document.getElementById('film-search');});
    await page.getByRole('button',{name:/^View details:/}).first().click();
    await page.locator('#title-carousel').waitFor({state:'visible'});
    assert.equal(await page.locator('#film-search').count(),1);
    assert.ok(await page.evaluate(()=>window.originalFilterNode===document.querySelector('#detail-filter-controls #film-search')));
    const first=await page.locator('#dialog-title').textContent();
    await page.locator('#carousel-next').click();
    assert.notEqual(await page.locator('#dialog-title').textContent(),first);
    await page.locator('#carousel-previous').click();assert.equal(await page.locator('#dialog-title').textContent(),first);
    await page.locator('#title-carousel').focus();await page.keyboard.press('ArrowRight');
    assert.notEqual(await page.locator('#dialog-title').textContent(),first);
    await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('#dialog-title').textContent(),first);
    await page.locator('#genre-filter').selectOption('Action');
    assert.ok((await page.locator('#carousel-counter').textContent()).includes('20 matching'));
    await page.locator('#film-sort').selectOption('year-desc');
    await page.locator('#film-search').fill('NO SUCH TITLE XXXXX');
    await page.locator('#carousel-empty').waitFor({state:'visible'});
    assert.equal(await page.locator('.detail-hero').isVisible(),false);
    await page.locator('#carousel-reset').click();
    await page.locator('#carousel-cards').waitFor({state:'visible'});
    await page.locator('#dialog-poster').click();
    await page.locator('#detail-expanded').waitFor({state:'visible'});
    assert.equal(await page.locator('#expand-details').getAttribute('aria-expanded'),'true');
    await page.locator('#open-filters').click();
    await page.locator('#filter-type').selectOption('series');
    await page.locator('#apply-filters').click();
    await page.locator('#carousel-empty').waitFor({state:'visible'});
    await page.locator('#carousel-reset').click();
    await page.locator('#genre-filter').selectOption('Action');
    await page.screenshot({path:path.join(out,`${v.name}-selection.png`)});
    await page.locator('#close-dialog').click();
    assert.ok(await page.evaluate(()=>window.originalFilterNode===document.querySelector('#browse-controls-home #film-search')));
    assert.equal(await page.locator('#genre-filter').inputValue(),'Action');
    assert.equal(await page.locator('.movie-card').count(),20);
    assert.equal(result.playerWrites,0,'Browsing never requests source resolution or playback');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
    assert.deepEqual(result.errors,[]);
    result.checks.push('same filter nodes retained','next/previous and keyboard','zero-result recovery','more-details disclosure','drawer applies to same selection','back preserves active filters','no autoplay or source request','no horizontal overflow');result.pass=true;
   }catch(e){result.failure=e.message;await page.screenshot({path:path.join(out,`${v.name}-failure.png`)}).catch(()=>{});}
   await ctx.close();
  }
 } finally {await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({pass:results.every(r=>r.pass),results},null,2));console.log(JSON.stringify(results,null,2));}
 if(!results.every(r=>r.pass))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});

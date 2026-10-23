'use strict';
// Isolated local store; provider/player routes intercepted. Never starts media.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.MOVIE_NIGHT_PLAYWRIGHT||'/media/chrishallberg/Storage 22/999_Work/003_Projects/017_xi-io_inbox/node_modules/playwright');
const base=process.env.MOVIE_NIGHT_URL;assert(base&&['127.0.0.1','localhost'].includes(new URL(base).hostname));
const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
const results=[];
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const viewport of [{name:'desktop',width:1440,height:1000},{name:'tablet',width:768,height:1024},{name:'phone',width:430,height:900}]){
   const ctx=await browser.newContext({viewport,reducedMotion:'reduce',serviceWorkers:'block'});const p=await ctx.newPage();p.setDefaultTimeout(12000);
   const result={viewport:viewport.name,pass:false,checks:[],errors:[],playbackWrites:0};results.push(result);
   p.on('pageerror',error=>result.errors.push(error.message));
   await ctx.route('**/api/personal-library**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({favorites:[],recent:[],watched:[],collections:[],imported_at:null})}));
   await ctx.route('**/api/player/**',route=>{if(route.request().method()==='POST')result.playbackWrites++;return route.fulfill({contentType:'application/json',body:JSON.stringify({state:'idle',imdb_id:'',title:'',volume:50})});});
   await ctx.route('**/api/browse/meta?**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({movie:{},source:'synthetic'})}));
   try{
    let doc=await (await ctx.request.get(base+'/api/filter-cubes')).json();
    const reset=await ctx.request.post(base+'/api/filter-cubes',{headers:{'X-Movie-Night':'1'},data:{...doc,rows:[],selected_id:null,view:'wall'}});assert.equal(reset.status(),200);
    await p.goto(base,{waitUntil:'domcontentloaded'});
    await p.waitForFunction(()=>document.querySelectorAll('.movie-card').length===100&&document.getElementById('cube-add')&&!document.getElementById('cube-add').disabled);
    await p.locator('#cube-view-carousel').click();await p.locator('.cube-welcome').waitFor();
    async function add(name){await p.locator('#cube-add').click();await p.locator('#cube-builder-next').click();await p.locator('#cube-builder-next').click();await p.locator('#cube-name').fill(name);await p.locator('#cube-confirm').click();await p.locator('#cube-naming').waitFor({state:'hidden'});}
    await add('All classics');
    let row=p.locator('.cube-row').first();await row.locator('.cube-cover[aria-current=true]').waitFor();
    assert.equal(await row.locator('.cube-cover').count(),9,'Only the nearest nine cards render');
    const before=await row.locator('.cube-track').getAttribute('data-selected');
    await row.getByRole('button',{name:'Previous title in All classics',exact:true}).click();
    await p.waitForFunction(()=>document.querySelector('.cube-track').dataset.index==='99');
    await row.getByRole('button',{name:'Next title in All classics',exact:true}).click();
    assert.equal(await row.locator('.cube-track').getAttribute('data-selected'),before);
    const geometry=await row.locator('.cube-track').evaluate(track=>{const a=track.getBoundingClientRect(),b=track.querySelector('[aria-current=true]').getBoundingClientRect();return Math.abs((a.left+a.width/2)-(b.left+b.width/2));});assert(geometry<2,'Selected cover stays centred');
    const verticalAllowed=await row.locator('.cube-track').evaluate(track=>track.dispatchEvent(new WheelEvent('wheel',{deltaY:80,bubbles:true,cancelable:true})));assert(verticalAllowed,'Normal vertical page scrolling is not trapped');
    result.checks.push('nine-card virtualization','bidirectional wrap','centred cover','vertical scrolling preserved');
    await p.locator('#genre-filter').selectOption('Action');await add('Action nights');
    const action=p.locator('.cube-row').filter({has:p.getByRole('heading',{name:'Action nights',exact:true})});await action.scrollIntoViewIfNeeded();await action.locator('.cube-track').waitFor();
    await p.waitForFunction(()=>[...document.querySelectorAll('.cube-row')].find(r=>r.querySelector('h2').textContent==='Action nights')?.querySelector('.cube-track').dataset.count==='20');
    assert.equal(await p.locator('.cube-row').first().locator('.cube-track').getAttribute('data-count'),'100');
    result.checks.push('independent live filter rows');
    await p.locator('#cube-edit').click();
    await p.locator('.cube-row').first().getByRole('button',{name:'Move down',exact:true}).click();
    assert.equal(await p.locator('.cube-row h2').first().textContent(),'Action nights');
    await p.locator('#cube-cancel-layout').click();assert.equal(await p.locator('.cube-row h2').first().textContent(),'All classics');
    await p.locator('#cube-edit').click();await p.locator('.cube-row').first().getByRole('button',{name:'Move down',exact:true}).click();await p.locator('#cube-save-layout').click();await p.locator('#cube-edit').waitFor({state:'visible'});
    result.checks.push('unlock reorder','cancel restores order','save persists order');
    await p.locator('.cube-row').first().locator('.cube-cover[aria-current=true]').click();await p.locator('#film-dialog').waitFor({state:'visible'});
    assert.equal(await p.locator('#carousel-cards .cube-cover').count(),9);await p.locator('#carousel-next').click();await p.locator('#close-dialog').click();await p.locator('#cube-home').waitFor({state:'visible'});
    await p.locator('#cube-view-wall').click();await p.locator('#film-grid').waitFor({state:'visible'});await p.waitForFunction(()=>document.querySelectorAll('.movie-card').length===20);
    assert.equal(await p.locator('#genre-filter').inputValue(),'Action');await p.locator('#cube-view-carousel').click();
    result.checks.push('same details carousel','wall/carousel filter parity','back restores home');
    await p.reload({waitUntil:'domcontentloaded'});await p.locator('#cube-home').waitFor({state:'visible'});await p.locator('.cube-row .cube-cover[aria-current=true]').first().waitFor();
    assert.equal(await p.locator('.cube-row h2').first().textContent(),'Action nights');assert.equal(await p.locator('.cube-row').count(),2);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
    assert.deepEqual(result.errors,[]);assert.equal(result.playbackWrites,0);
    await p.locator('.cube-row').first().scrollIntoViewIfNeeded();await p.screenshot({path:path.join(out,viewport.name+'-cubes.png')});
    result.checks.push('reopen recovers layout and query results','no horizontal overflow','no playback writes');result.pass=true;
   }catch(error){result.failure=error.stack;await p.screenshot({path:path.join(out,viewport.name+'-failure.png')}).catch(()=>{});}
   await ctx.close();
  }
 }finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));}
 if(!results.every(r=>r.pass))process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});

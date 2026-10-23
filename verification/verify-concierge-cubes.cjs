"use strict";
// Real React shell, iframe, chat endpoint, cube validator/writer and HTTP readback.
// Dedicated disposable Python host; model responses and native bindings are fixtures.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.MOVIE_NIGHT_PLAYWRIGHT||'playwright');
const base=process.env.MOVIE_NIGHT_URL;assert.ok(base&&new URL(base).hostname==='127.0.0.1');
const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.MOVIE_NIGHT_CHROME||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const report={width:Number(process.env.MOVIE_NIGHT_TEST_WIDTH||1440),proof:'REAL_BROWSER_AND_DISPOSABLE_HTTP_CUBE_SERVICE',model:'FIXTURE',native:'SIMULATED',realMedia:false,checks:[],errors:[],forbiddenWrites:[]};
 const ctx=await browser.newContext({viewport:{width:Number(process.env.MOVIE_NIGHT_TEST_WIDTH||1440),height:1000},serviceWorkers:'block',reducedMotion:'reduce'}),page=await ctx.newPage();page.setDefaultTimeout(15000);
 const cubePosts=[];let lastProposal;
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('response',async r=>{if(r.url().endsWith('/api/concierge/chat')&&r.status()===200){const d=await r.json();if(d.cube_operation)lastProposal=d.cube_operation;}});
 await ctx.addInitScript(()=>{window.__MOVIE_NIGHT_NATIVE__=true;window.__TAURI_INTERNALS__={invoke:async c=>c==='native_movie_window'?{maximized:false,fullscreen:false,focused:true,transparency:{available:false}}:false};});
 await ctx.route('**/*',route=>{
   const req=route.request(),u=new URL(req.url());if(u.origin!==base)return route.abort();
   if(req.method()==='POST'&&u.pathname==='/api/filter-cubes')cubePosts.push(req.postDataJSON());
   if(req.method()!=='GET'&&!['/api/filter-cubes','/api/concierge/chat','/__test/mode'].includes(u.pathname)){
     report.forbiddenWrites.push(u.pathname);return route.fulfill({status:403,body:'{"error":"Test prohibits this effect"}',contentType:'application/json'});
   }
   return route.continue();
 });
 const wall=page.frameLocator('#movie-wall');
 const read=async()=>{const r=await ctx.request.get(base+'/api/filter-cubes');assert.equal(r.status(),200);return r.json();};
 async function ask(text){
   if(!await page.locator('.concierge').isVisible())await page.locator('[data-window-utility="chat"]').click();
   await page.getByText('Local model ready',{exact:true}).waitFor();
   await page.locator('#concierge-prompt').fill(text);const answer=page.waitForResponse(r=>r.url().endsWith('/api/concierge/chat')&&r.request().method()==='POST');
   await page.locator('.concierge-composer button[type="submit"]').click();const response=await answer;const body=await response.json();assert.equal(response.status(),200,JSON.stringify(body));
   await page.locator('.cube-proposal').waitFor();return body.cube_operation;
 }
 async function confirmCreate(){
   await page.getByRole('button',{name:'Review cube change',exact:true}).click();await wall.locator('#cube-naming').waitFor();
   await page.locator('[data-window-utility="chat"]').click();await page.locator('#concierge-prompt').fill('Draft retained while review is open');
   assert.equal(await page.locator('.concierge-composer button[type="submit"]').isDisabled(),true);
   await page.getByRole('button',{name:'Close concierge',exact:true}).click();
   await wall.locator('#cube-builder-next').click();await wall.locator('#cube-confirm').click();await page.locator('.cube-operation-result').waitFor();
   assert.equal(await page.locator('#concierge-prompt').inputValue(),'Draft retained while review is open');
 }
 try{
  await page.goto(base+'/studio/',{waitUntil:'domcontentloaded'});await wall.locator('#cube-add').waitFor();await wall.locator('[data-collection="library"]').click();
  await page.waitForFunction(()=>typeof document.querySelector('#movie-wall')?.contentWindow?.movieNightCubeContext==='function');
  const initial=await read();const op=await ask('can you create me a cube of western novies from 1985-to present?');
  assert.equal(op.action,'create');assert.equal(op.row.filters.yearTo,'present');assert.equal(op.row.filters.yearFrom,'1985');assert.deepEqual(await read(),initial);assert.equal(cubePosts.length,0);
  report.checks.push('actual chat route proposes existing schema, exact source and rolling year; no write on generation');
  await confirmCreate();let document=await read();assert.equal(document.rows.length,1);assert.equal(document.rows[0].id,op.cube_id);assert.equal(document.revision,1);assert.equal(cubePosts.length,1);
  assert.ok((await page.locator('.cube-operation-result').innerText()).includes(op.cube_id));assert.ok((await page.locator('.cube-operation-result').innerText()).includes('revision 1'));
  report.checks.push('review opens the same manual wizard; one real service write and separate GET confirm ID/revision in chat and row');
  if(process.env.MOVIE_NIGHT_EXACT_REQUESTS==='1') {
    const fantasy=await ask('can you make me a cube of movies from 2010-2015 that are high fantasy?');
    assert.equal(fantasy.row.genre,'Fantasy');assert.equal(fantasy.row.filters.yearFrom,'2010');assert.equal(fantasy.row.filters.yearTo,'2015');
    assert.match(await page.locator('.cube-review-note').innerText(),/broader Fantasy/);
    assert.equal((await read()).rows.length,1);await confirmCreate();
    const stored=await read();assert.equal(stored.rows.length,2);assert.equal(stored.revision,2);assert.equal(cubePosts.length,2);
    assert.equal(stored.rows[1].id,fantasy.cube_id);assert.match(stored.rows[1].name,/broader matches/);
    await page.getByRole('button',{name:'Close concierge',exact:true}).click();
    const fantasyRow=wall.locator(`[data-cube-id="${fantasy.cube_id}"]`);await fantasyRow.scrollIntoViewIfNeeded();
    await fantasyRow.locator('.cube-track[data-count="1"]').waitFor();
    assert.equal(await fantasyRow.locator('.cube-track').getAttribute('data-count'),'1');
    assert.match(await fantasyRow.innerText(),/Fantasy fixture/);
    // Chat was deliberately closed above; the existing store correctly keeps it closed.
    await page.reload({waitUntil:'domcontentloaded'});
    await wall.locator(`[data-cube-id="${fantasy.cube_id}"]`).waitFor();assert.deepEqual(await read(),stored);
    assert.equal(await page.locator('.concierge').isVisible(),false);
    report.checks.push('exact owner Western typo/range and high-fantasy request: two reviewed saves, explicit approximation, real matching row, fresh-page reopen');
    report.model='NO_INFERENCE_FOR_EXPLICIT_FILTERS';report.pass=true;report.realCubeWrites=cubePosts.length;report.finalRevision=stored.revision;
    assert.deepEqual(report.errors,[]);assert.deepEqual(report.forbiddenWrites,[]);
    await page.screenshot({path:path.join(out,'exact-requests.png')});return;
  }
  if(process.env.MOVIE_NIGHT_REAL_MODEL==='1') {
    const stored=await read();await page.reload({waitUntil:'domcontentloaded'});await page.locator('.concierge').waitFor();
    assert.ok((await page.locator('.concierge-transcript').innerText()).includes(op.cube_id));
    await page.getByRole('button',{name:'Close concierge',exact:true}).click();await wall.locator('.cube-row').first().waitFor();
    assert.deepEqual(await read(),stored);assert.equal(await wall.locator('.cube-row').first().getAttribute('data-cube-id'),op.cube_id);
    report.checks.push('real local model proposal travels through chat, review, actual existing service, storage readback and application reopen');
    report.model='REAL_LOCAL_OLLAMA';report.pass=true;report.realCubeWrites=cubePosts.length;report.finalRevision=stored.revision;
    assert.deepEqual(report.errors,[]);assert.deepEqual(report.forbiddenWrites,[]);
    await page.screenshot({path:path.join(out,'real-model-cube.png')});return;
  }
  const firstId=op.cube_id;
  const edited=await ask('Edit this cube to Western movies since 1995');assert.equal(edited.cube_id,firstId);assert.equal((await read()).revision,1);
  await confirmCreate();document=await read();assert.equal(document.rows.length,1);assert.equal(document.rows[0].id,firstId);assert.equal(document.rows[0].filters.yearFrom,'1995');assert.equal(document.rows[0].filters.yearTo,'');
  report.checks.push('edit preserves cube identity and updates only the existing row through the same service');
  const stale=await page.evaluate(async op=>{try{await document.querySelector('#movie-wall').contentWindow.movieNightReviewCube(op);return null;}catch(e){return e.message;}},op);
  assert.match(stale,/revision changed/i);assert.equal(cubePosts.length,2);
  report.checks.push('replayed stale create is refused without a second effect');
  const wrong={...edited,expected_revision:document.revision,source_scope:'foreign-tenant-library',row:{...edited.row,collectionId:'foreign-tenant-library'}};
  const wrongResult=await page.evaluate(async op=>{try{await document.querySelector('#movie-wall').contentWindow.movieNightReviewCube(op);return null;}catch(e){return e.message;}},wrong);
  assert.match(wrongResult,/different or unavailable/i);assert.equal(cubePosts.length,2);
  report.checks.push('wrong library scope rejected before opening review or attempting a write');
  await ask('Remove this cube');await page.getByRole('button',{name:'Review cube change',exact:true}).click();await wall.locator('#cube-delete').waitFor();assert.equal((await read()).rows.length,1);
  await wall.getByRole('button',{name:'Keep row',exact:true}).click();await page.locator('.cube-operation-result').waitFor();assert.equal((await read()).rows.length,1);assert.equal(cubePosts.length,2);
  await ask('Remove this cube');await page.getByRole('button',{name:'Review cube change',exact:true}).click();await wall.getByRole('button',{name:'Remove row',exact:true}).click();await page.locator('.cube-operation-result').waitFor();assert.equal((await read()).rows.length,0);assert.equal(cubePosts.length,3);
  report.checks.push('removal has explicit confirmation, cancellation is no-effect, and confirmed removal changes only the cube document');
  // Manual and chat interpretation use the same declaration, evaluator and writer.
  await page.getByRole('button',{name:'Close concierge',exact:true}).click();await wall.locator('#cube-add').click();await wall.locator('#cube-source').selectOption('library');await wall.locator('#cube-builder-next').click();
  await wall.locator('#cube-rule-type').selectOption('movie');await wall.locator('#cube-rule-genre').selectOption('Western');await wall.locator('#cube-rule-yearFrom').fill('1985');await wall.locator('#cube-rule-yearTo').fill('present');await wall.locator('#cube-builder-next').click();await wall.locator('#cube-name').fill('Manual parity');await wall.locator('#cube-confirm').click();await wall.locator('#cube-naming').waitFor({state:'hidden'});
  document=await read();const manual=document.rows[0];for(const field of ['filters','collectionId','browse','genre','search','sort'])assert.deepEqual(manual[field],op.row[field],field);
  report.checks.push('manual and chat requests persist identical query fields, including rolling current-year endpoint');
  // ACKed write + denied readback must not become chat success or repeat POST.
  await ask('Edit this cube to Western movies since 1995');await page.getByRole('button',{name:'Review cube change',exact:true}).click();await wall.locator('#cube-builder-next').click();
  await ctx.request.post(base+'/__test/mode',{data:{mode:'deny-read-after-write'}});const count=cubePosts.length;
  await wall.locator('#cube-confirm').click();await wall.locator('#cube-reconcile').waitFor({state:'visible'});assert.equal(cubePosts.length,count+1);
  assert.equal(await wall.locator('#cube-confirm').isDisabled(),true);assert.equal(await page.locator('.cube-operation-result').count(),0);
  await ctx.request.post(base+'/__test/mode',{data:{mode:'normal'}});await wall.locator('#cube-reconcile').click();await page.locator('.cube-operation-result').waitFor();assert.equal(cubePosts.length,count+1);
  report.checks.push('write-success/readback-denial remains unconfirmed; reachable reconciliation uses GET only before chat confirmation');
  const stored=await read();await page.reload({waitUntil:'domcontentloaded'});await page.locator('.concierge').waitFor();await page.getByRole('button',{name:'Close concierge',exact:true}).click();await wall.locator('.cube-row').first().waitFor();assert.deepEqual(await read(),stored);
  assert.equal(await wall.locator('.cube-row').first().getAttribute('data-cube-id'),stored.rows[0].id);
  report.checks.push('application reopen recovers the persisted identity and query; chat and manual paths do not create a second store');
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.forbiddenWrites,[]);report.pass=true;report.finalRevision=stored.revision;report.realCubeWrites=cubePosts.length;
  await page.screenshot({path:path.join(out,'chat-cube-journey.png')});
 }catch(e){report.pass=false;report.error=e.stack;await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}
 finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();}
 if(!report.pass)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});

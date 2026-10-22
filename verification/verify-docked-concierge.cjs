"use strict";
// Real local Ollama; simulated native host bridge. No media starts or user-library writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.MOVIE_NIGHT_PLAYWRIGHT||'/media/chrishallberg/Storage 22/999_Work/003_Projects/017_xi-io_inbox/node_modules/playwright');
const base=process.env.MOVIE_NIGHT_URL;assert.ok(base&&['127.0.0.1','localhost'].includes(new URL(base).hostname));
const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:1500,height:1000},reducedMotion:'reduce',serviceWorkers:'block'});
 const result={pass:false,checks:[],pageErrors:[],playerWrites:0,nativeBridge:'SIMULATED',ollama:'NOT_TESTED'};
 const page=await ctx.newPage();page.setDefaultTimeout(15000);
 page.on('pageerror',e=>result.pageErrors.push(e.message));
 await ctx.addInitScript(()=>{window.__MOVIE_NIGHT_NATIVE__=true;window.__TAURI_INTERNALS__={invoke:async(command)=>command==='native_movie_window'?{maximized:false,fullscreen:false,focused:true,transparency:{available:false}}:false};});
 await ctx.route('**/api/player/**',route=>{if(route.request().method()==='POST')result.playerWrites++;return route.fulfill({contentType:'application/json',body:JSON.stringify({state:'idle',imdb_id:'',title:'',volume:50})});});
 await ctx.route('**/api/concierge/save',route=>route.fulfill({status:403,contentType:'application/json',body:'{"error":"Test blocks saved-library writes"}'}));
 try{
  await page.goto(new URL('/studio/',base).href,{waitUntil:'domcontentloaded'});
  const wall=page.frameLocator('#movie-wall');
  await wall.locator('.movie-card').first().waitFor();
  await page.getByRole('button',{name:'Ask @ibal',exact:true}).click();
  await page.locator('aside[data-chat-drop-target="personal:movie-night"] .concierge').waitFor({state:'visible'});
  assert.equal(await page.locator('.concierge').count(),1);
  await page.getByText('Local model ready',{exact:true}).waitFor();
  const rect=await page.locator('.concierge').boundingBox(), wrect=await page.locator('#movie-wall').boundingBox();
  assert.ok(rect.x>=wrect.x+wrect.width-2,'Chat must be alongside wall on right');
  await wall.locator('#genre-filter').selectOption('Action');
  await page.locator('.concierge-context').getByText('20 matching titles',{exact:true}).waitFor();
  result.checks.push('one right-docked conversation','real local model tags','current filtered selection shared with chat');
  const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/concierge/chat')&&r.request().method()==='POST',{timeout:140000});
  await page.locator('#concierge-prompt').fill('Choose two action films from this selection for a relaxed movie night.');
  await page.locator('.concierge-composer button[type="submit"]').click();
  const response=await responsePromise;const answer=await response.json();
  assert.equal(response.status(),200,JSON.stringify(answer));
  assert.ok(typeof answer.message==='string'&&answer.message.length>0);
  assert.ok(answer.model);assert.equal(answer.eligible_count,20);
  result.ollama='REAL_LOCAL_REPLY';result.model=answer.model;result.reply=answer.message;result.proposalCount=answer.collection?.movies?.length||0;
  await page.locator('.chat-message.assistant').last().waitFor();
  await page.screenshot({path:path.join(out,'right-dock.png')});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('aside[data-chat-drop-target="personal:movie-night"] .concierge').waitFor({state:'visible'});
  await page.locator('.chat-message.assistant').last().waitFor();
  result.checks.push('actual Ollama reply','dock and conversation restored after page restart');
  await page.getByRole('button',{name:'Close concierge',exact:true}).click();
  await page.reload({waitUntil:'domcontentloaded'});await page.frameLocator('#movie-wall').locator('.movie-card').first().waitFor();
  assert.equal(await page.locator('.concierge').count(),0,'Dismissed panel must remain dismissed');
  await page.getByRole('button',{name:'Ask @ibal',exact:true}).click();
  await page.locator('.concierge').waitFor({state:'visible'});
  await page.setViewportSize({width:768,height:1024});
  await page.locator('.movie-native-concierge .concierge').waitFor({state:'visible'});
  assert.equal(await page.locator('.concierge').count(),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  await page.screenshot({path:path.join(out,'tablet-chat.png')});
  result.checks.push('dismissal survives page restart','tablet has one usable conversation');
  assert.deepEqual(result.pageErrors,[]);assert.equal(result.playerWrites,0);result.pass=true;
 }catch(e){result.failure=e.stack;await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}
 finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await browser.close();}
 if(!result.pass)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});

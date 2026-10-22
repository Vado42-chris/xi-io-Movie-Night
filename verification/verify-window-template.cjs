"use strict";
// Actual shell components in Chromium. Network and native calls are intercepted.
// This does not certify Tauri, BINS, settings effects, inference or other products.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.MOVIE_NIGHT_PLAYWRIGHT||'/media/chrishallberg/Storage 22/999_Work/003_Projects/017_xi-io_inbox/node_modules/playwright');
const build=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]);
const fallback=process.argv.includes('--without-container-rules');
fs.mkdirSync(out,{recursive:true});
const report={source:'actual shared WindowFrame, ChatDockSlot and Movie Night consumer',native:'SIMULATED_ONLY',network:'chat response fixture; player blocked; read-only catalogue/settings',fallback,allocationMethod:'actual frame CSS allocation, verified by bounding box; not OS resize',checks:[],errors:[],writes:[],failures:[]};
async function check(name,fn){try{await fn();report.checks.push({name,pass:true});}catch(e){report.checks.push({name,pass:false,error:e.message});report.failures.push(name);}}
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 report.browser=browser.version();
 const context=await browser.newContext({viewport:{width:1920,height:1000},serviceWorkers:'block',reducedMotion:'reduce'});
 await context.addInitScript(()=>{
  window.__MOVIE_NIGHT_NATIVE__=true;window.__nativeCalls=[];
  window.__TAURI_INTERNALS__={invoke:async(command,args)=>{
   window.__nativeCalls.push({command,args});
   if(command==='native_movie_window')return {maximized:false,fullscreen:false,focused:true,transparency:{available:false}};
   if(command==='set_movie_viewport')return {...args,active:false};
   return false;
  }};
 });
 const page=await context.newPage();page.setDefaultTimeout(8000);
 page.on('pageerror',e=>report.errors.push(e.message));
 let releaseReply;const pendingReply=new Promise(resolve=>releaseReply=resolve);let chatSends=0;
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.origin!=='http://127.0.0.1:8789')return route.abort();
  if(u.pathname.startsWith('/studio/')){
   let rel=u.pathname.slice('/studio/'.length)||'index.html';if(rel==='')rel='index.html';
   const file=path.resolve(build,rel);if(!file.startsWith(build+path.sep))return route.abort();
   if(!fs.existsSync(file)||!fs.statSync(file).isFile())return route.fulfill({status:404,body:'Missing fixture asset'});
   let body=fs.readFileSync(file);const ext=path.extname(file);
   if(ext==='.css'&&fallback){
    const postcss=require(path.resolve(__dirname,'../studio-shell/node_modules/postcss'));
    const ast=postcss.parse(body.toString());let removed=0;ast.walkAtRules('container',r=>{removed++;r.remove();});
    report.removedContainerRules=(report.removedContainerRules||0)+removed;body=Buffer.from(ast.toString());
   }
   return route.fulfill({status:200,contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css'})[ext]||'application/octet-stream',body});
  }
  if(u.pathname.startsWith('/api/player/')){
   if(req.method()!=='GET'){
    report.writes.push({path:u.pathname,method:req.method(),intercepted:true});
    return route.fulfill({status:403,contentType:'application/json',body:'{"error":"Test forbids playback mutations"}'});
   }
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({state:'idle',imdb_id:null,title:'',position:null,duration:null,volume:50,muted:false,fullscreen:false})});
  }
  if(u.pathname==='/api/concierge/status')return route.fulfill({contentType:'application/json',body:JSON.stringify({available:true,enabled:true,model:'test-fixture-only'})});
  if(req.method()!=='GET'){
   report.writes.push({path:u.pathname,method:req.method(),intercepted:true});
   if(u.pathname==='/api/concierge/chat'){
    chatSends++;await pendingReply;return route.fulfill({contentType:'application/json',body:JSON.stringify({message:'Fixture reply after close and resize. No action executed.'})});
   }
   return route.fulfill({status:403,contentType:'application/json',body:'{"error":"Test blocks mutations"}'});
  }
  return route.continue();
 });
 try{
  await page.goto('http://127.0.0.1:8789/studio/',{waitUntil:'domcontentloaded'});
  const rail=page.locator('[data-window-rail="left"]').first();await rail.waitFor();
  const restore=rail.locator('[data-window-utility="chat"]');
  await check('BINS/chat/Settings belong to the existing left rail, separate from lifecycle',async()=>{
   assert.deepEqual(await rail.locator('[data-window-utility]').evaluateAll(nodes=>nodes.map(n=>n.dataset.windowUtility)),['bins','chat','settings']);
   assert.equal(await rail.locator('.window-lifecycle-controls [data-window-utility]').count(),0);
   assert.equal(await page.locator('[data-window-utility="settings"]').count(),1);
   assert.equal(await page.locator('button svg.lucide-settings').count(),1,'one Settings cog, owned by the left rail');
   assert.equal(await page.getByRole('button',{name:'Movie wall',exact:true}).count(),0,'root app glyph is not repeated as a single tab');
   assert.equal(await page.locator('.native-title-action.native-settings-button,.concierge-settings').count(),0,'no title-bar or chat-header copies');
  });
  await restore.click();await page.locator('#concierge-prompt').waitFor({state:'visible'});
  await check('restored chat does not introduce another settings cog',async()=>{assert.equal(await page.locator('button svg.lucide-settings').count(),1);});
  await check('left-rail Settings opens the existing dialog without saving',async()=>{
   await rail.locator('[data-window-utility="settings"]').click();
   await page.locator('#movie-settings[open]').waitFor();
   assert.equal(await page.locator('#movie-settings').isVisible(),true);
   await page.locator('#movie-settings').press('Escape');
   await page.waitForFunction(()=>!document.querySelector('#movie-settings[open]'));
  });
  await page.locator('#concierge-prompt').fill('Keep this draft while the window changes.');
  await page.locator('#concierge-prompt').evaluate(el=>{window.__originalPrompt=el;window.__originalConcierge=el.closest('.concierge');el.focus();el.setSelectionRange(5,9);});
  await check('wide content and right chat do not overlap',async()=>{
   const w=await page.locator('#movie-wall').boundingBox(),c=await page.locator('.concierge').boundingBox();
   if(fallback) assert.ok(!w&&c&&c.width>250,'no-container fallback must retain a usable foreground chat pane');
   else assert.ok(w&&c&&c.x>=w.x+w.width-2);
  });
  // Fixed browser width, narrow allocated parent: not a viewport resize or mocked rerender.
  await page.locator('[data-native-frame="true"]').evaluate(el=>{el.style.setProperty('width','480px','important');el.style.setProperty('right','auto','important');});await page.waitForTimeout(250);
  await check('480px allocated pane in a 1920px browser has reachable chat',async()=>{
   const frame=await page.locator('[data-native-frame="true"]').boundingBox();
   const chat=await page.locator('.concierge').boundingBox();const prompt=await page.locator('#concierge-prompt').boundingBox();
   assert.equal(Math.round(frame.width),480,'fixture did not constrain the actual frame');
   const wall=await page.locator('#movie-wall').boundingBox();
   assert.ok(!wall||wall.width>=240,'narrow layout leaves the content as an unusable sliver');
   assert.ok(chat&&prompt&&chat.width>=250,'chat collapsed or clipped');
   assert.ok(chat.x+chat.width<=frame.x+frame.width+2,'chat overflows allocated frame');
   assert.ok(prompt.x+prompt.width<=frame.x+frame.width+2,'composer overflows allocated frame');
  });
  await check('real reflow retains DOM instance, draft, selection and focus',async()=>{
   assert.equal(await page.locator('#concierge-prompt').inputValue(),'Keep this draft while the window changes.');
   assert.deepEqual(await page.locator('#concierge-prompt').evaluate(el=>({same:el===window.__originalPrompt,focused:el===document.activeElement,start:el.selectionStart,end:el.selectionEnd})),{same:true,focused:true,start:5,end:9});
  });
  await check('close returns focus and left-rail restore retains the same conversation',async()=>{
   await page.getByRole('button',{name:'Close concierge',exact:true}).click();await page.waitForTimeout(60);
   assert.equal(await restore.evaluate(el=>el===document.activeElement),true);
   await restore.click();assert.equal(await page.locator('#concierge-prompt').inputValue(),'Keep this draft while the window changes.');
   assert.equal(await page.locator('.concierge').evaluate(el=>el===window.__originalConcierge),true);
  });
  await check('in-flight response is neither lost nor resent across hide/reflow',async()=>{
   await page.locator('#concierge-prompt').fill('Fixture request');await page.locator('.concierge-composer button[type=submit]').click();
   await page.waitForTimeout(80);assert.equal(chatSends,1);
   await page.getByRole('button',{name:'Close concierge',exact:true}).click();
   await page.locator('[data-native-frame="true"]').evaluate(el=>el.style.setProperty('width','1100px','important'));
   releaseReply();await page.waitForTimeout(120);await restore.click();
   await page.getByText('Fixture reply after close and resize. No action executed.',{exact:true}).waitFor();assert.equal(chatSends,1);
  });
  await check('unbound BINS is not represented as an authorized file operation',async()=>{
   assert.equal(await rail.locator('[data-window-utility="bins"]').isDisabled(),true);
   assert.equal(report.writes.some(x=>x.path.includes('bins')),false);
  });
  for(const width of [320,390,768,1280,1920]){
   await page.locator('[data-native-frame="true"]').evaluate((el,w)=>el.style.setProperty('width',w+'px','important'),width);await page.waitForTimeout(80);
   await check('allocation '+width+'px has no outer horizontal overflow and a single conversation',async()=>{
    assert.equal(Math.round((await page.locator('[data-native-frame="true"]').boundingBox()).width),width,'actual frame allocation differs');
    assert.equal(await page.locator('.concierge').count(),1);
    assert.equal(await page.locator('[data-native-frame="true"]').evaluate(el=>el.scrollWidth>el.clientWidth+2),false);
    assert.equal(await page.locator('#concierge-prompt').isVisible(),true);
    const f=await page.locator('[data-native-frame="true"]').boundingBox(),c=await page.locator('.concierge').boundingBox(),i=await page.locator('#concierge-prompt').boundingBox();
    assert.ok(c.width>=Math.min(250,width-70)&&c.x+c.width<=f.x+f.width+2,'chat must fit, not merely be clipped');
    assert.ok(i.x+i.width<=f.x+f.width+2,'composer must fit');
   });
  }
  await page.locator('[data-native-frame="true"]').evaluate(el=>{el.style.setProperty('width','480px','important');el.style.setProperty('height','320px','important');el.style.setProperty('bottom','auto','important');});await page.waitForTimeout(120);
  await check('short-height utility rail controls are scroll-reachable',async()=>{
   const settings=rail.locator('[data-window-utility="settings"]');await settings.scrollIntoViewIfNeeded();assert.equal(await settings.isVisible(),true);
   const close=rail.getByRole('button',{name:'Close window',exact:true});await close.scrollIntoViewIfNeeded();assert.equal(await close.isVisible(),true);
  });
  await check('short-height composer can be brought fully into view',async()=>{
   const send=page.locator('.concierge-composer button[type=submit]');await send.scrollIntoViewIfNeeded();
   const f=await page.locator('[data-native-frame="true"]').boundingBox(),b=await send.boundingBox();
   assert.ok(b&&b.y>=f.y&&b.y+b.height<=f.y+f.height-20,'send control is clipped below the window');
  });
  await page.screenshot({path:path.join(out,'window-template.png')});
  if(fallback)await check('fallback truly removes container query rules',async()=>assert.ok(report.removedContainerRules>0));
  await check('no unhandled errors or unexpected domain writes',async()=>{assert.deepEqual(report.errors,[]);assert.ok(report.writes.every(x=>x.path==='/api/concierge/chat'));assert.equal(await page.evaluate(()=>window.__nativeCalls.some(x=>x.command!=='set_movie_viewport'&&!(x.command==='native_movie_window'&&x.args?.action==='state'))),false,'layout or chat issued a native action');});
 }catch(e){report.fatal=e.stack;releaseReply();await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}
 finally{releaseReply();report.pass=!report.fatal&&report.failures.length===0;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();}
 process.exitCode=report.pass?0:1;
})().catch(e=>{console.error(e);process.exitCode=1;});

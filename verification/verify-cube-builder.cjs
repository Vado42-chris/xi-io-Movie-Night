"use strict";
// Actual app and DOM interactions; isolated synthetic libraries and cube-store responses.
// No real account, media, user cube or host settings are changed.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.MOVIE_NIGHT_PLAYWRIGHT||'playwright');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
const defaults={yearFrom:'',yearTo:'',include:[],exclude:[],genreMode:'any',rating:0,runtime:'',type:'',watch:'',provider:''};
const original={id:'existing-cube',name:'Existing row',collectionId:'library',browse:null,filters:defaults,search:'',genre:'',sort:'rank',anchor:null};
const items=Array.from({length:8},(_,i)=>({id:`tt${8400000+i}`,imdbId:`tt${8400000+i}`,type:i===7?'series':'movie',title:`Test title ${i+1}`,year:1980+i*5,genres:i%2?['Drama']:['Western'],runtime:100,imdbRating:8,poster:''}));
(async()=>{const browser=await chromium.launch({executablePath:process.env.MOVIE_NIGHT_CHROME||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});const reports=[];
try{
 if(process.env.MOVIE_NIGHT_VERIFY_SERVED){
  const crypto=require('node:crypto'),identities=[];
  for(const file of ['app.js','index.html','style.css','filter-cubes.mjs','filter-cubes.css']){
   const response=await fetch('http://127.0.0.1:8789/'+file,{cache:'no-store'});assert.equal(response.status,200);
   const served=Buffer.from(await response.arrayBuffer()),expected=fs.readFileSync(path.join(root,'web',file));
   identities.push({file,sha256:crypto.createHash('sha256').update(served).digest('hex'),matches:served.equals(expected)});
  }
  fs.writeFileSync(path.join(out,'served-generation.json'),JSON.stringify(identities,null,2));
  assert.ok(identities.every(x=>x.matches),'ARIES_SERVED_GENERATION_MISMATCH');
 }
 for(const width of [390,768,1440]){
 const ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'}),page=await ctx.newPage();page.setDefaultTimeout(12000);
 const report={width,proof:'BROWSER_WITH_SYNTHETIC_CUBE_STORE',checks:[],errors:[],unexpectedWrites:[]};reports.push(report);
 let doc={schema:'movie-night.filter-cubes/v1',revision:1,view:'carousel',selected_id:original.id,rows:[structuredClone(original)]},writes=0,mode='normal',denyReads=0;
 page.on('pageerror',e=>report.errors.push(e.message));
 await ctx.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());if(u.origin!=='http://127.0.0.1:8789')return route.abort();
  const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(u.pathname==='/api/filter-cubes'){
   if(req.method()==='POST'){
    writes++;const next=req.postDataJSON();assert.equal(next.revision,doc.revision);
    if(mode==='refuse')return reply({error:'Validation refused',code:'invalid_cube_layout'},400);
    doc={...next,revision:doc.revision+1};
    if(mode==='lost'){denyReads=2;return route.abort('connectionreset');}
   }else if(mode==='readback-denied')return reply({error:'Readback denied'},403);
   else if(denyReads>0){denyReads--;return route.abort('connectionreset');}
   return reply(doc);
  }
  if(req.method()!=='GET'){report.unexpectedWrites.push(u.pathname);return reply({error:'Test blocks all non-cube actions'},403);}
  if(u.pathname.startsWith('/api/player/'))return reply({state:'idle',title:'',imdb_id:'',volume:50});
  if(u.pathname==='/api/personal-library')return reply({favorites:[],recent:[],watched:[],imported_at:null,collections:[{id:'nuvio-library',name:'Imported fixture',movies:items}]});
  if(u.pathname==='/api/library.json')return reply({title:'Movie Night',collections:[{id:'fixture',name:'Fixture catalogue',movies:items}]});
  if(u.pathname==='/api/browse/meta'){const id=u.searchParams.get('id');const m=items.find(x=>x.id===id);return reply({movie:{...m,episodes:m?.type==='series'?[]:undefined},source:'fixture'});}
  const rel=u.pathname==='/'?'index.html':u.pathname.slice(1),file=path.resolve(root,'web',rel);
  if(process.env.MOVIE_NIGHT_CUBE_OVERRIDE&&rel==='filter-cubes.mjs')return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(process.env.MOVIE_NIGHT_CUBE_OVERRIDE)});
  if(!process.env.MOVIE_NIGHT_VERIFY_SERVED&&file.startsWith(path.resolve(root,'web')+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({contentType:({'.mjs':'application/javascript','.js':'application/javascript','.css':'text/css','.html':'text/html'})[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
  return route.continue();
 });
 const shift=async(track,x,y,deltaMode=0)=>{await page.waitForTimeout(210);return track.evaluate((el,d)=>{const before=el.dataset.selected;const event=new WheelEvent('wheel',{bubbles:true,cancelable:true,shiftKey:true,deltaX:d.x,deltaY:d.y,deltaMode:d.mode});el.dispatchEvent(event);return {before,after:el.dataset.selected,prevented:event.defaultPrevented};},{x,y,mode:deltaMode});};
 async function next(){await page.locator('#cube-builder-next').click();}
 try{
  await page.goto('http://127.0.0.1:8789/',{waitUntil:'domcontentloaded'});await page.locator('.cube-row .cube-cover[aria-current=true]').first().waitFor();
  const track=page.locator('.cube-row .cube-track').first();
  const horizontal=await shift(track,80,0);assert.notEqual(horizontal.before,horizontal.after,'Shift + deltaX is swallowed');assert.equal(horizontal.prevented,true);
  const vertical=await shift(track,0,-80);assert.notEqual(vertical.before,vertical.after);assert.equal(vertical.prevented,true);
  const lines=await shift(track,0,3,1);assert.notEqual(lines.before,lines.after);
  const normal=await track.evaluate(el=>{const old=el.dataset.selected,event=new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:80});el.dispatchEvent(event);return {old,now:el.dataset.selected,prevented:event.defaultPrevented};});assert.equal(normal.old,normal.now);assert.equal(normal.prevented,false);
  await track.focus();const beforeKey=await track.getAttribute('data-selected');await page.keyboard.press('ArrowRight');assert.notEqual(await track.getAttribute('data-selected'),beforeKey);
  report.checks.push('both Shift-wheel axes and line units move cards; normal vertical scroll is not consumed; arrows own focused carousel');
  await page.locator('#cube-add-below').click();assert.equal(await page.locator('#cube-builder-progress').innerText(),'Step 1 of 3 · Source');
  await page.locator('#cube-source').selectOption('library');await next();
  await page.locator('#cube-rule-type').selectOption('movie');await page.locator('#cube-rule-genre').selectOption('Western');
  await page.locator('#cube-rule-yearFrom').fill('1985');await page.locator('#cube-rule-yearTo').fill('1980');await next();
  assert.ok((await page.locator('#cube-builder-feedback').innerText()).includes('end year'));assert.equal(writes,0);
  await page.locator('#cube-rule-yearTo').fill('');await next();
  assert.ok((await page.locator('#cube-builder-review').innerText()).includes('Western'));assert.ok((await page.locator('#cube-builder-preview').innerText()).includes('3 matching'));
  await page.locator('#cube-name').fill('Westerns since 1985');assert.equal(writes,0);
  await page.locator('#cube-confirm').click();await page.locator('#cube-naming').waitFor({state:'hidden'});
  assert.equal(writes,1);assert.equal(doc.rows.length,2);const created=structuredClone(doc.rows[1]);assert.equal(created.filters.yearFrom,'1985');assert.equal(created.filters.type,'movie');assert.equal(created.genre,'Western');assert.equal(created.collectionId,'library');assert.equal(created.name,'Westerns since 1985');assert.deepEqual(doc.rows[0].filters,defaults);
  report.checks.push('visible bottom add opens three-step manual wizard; invalid date range blocked; preview uses existing filter; save preserves other cubes and query');
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('.cube-row').nth(1).waitFor();assert.equal(await page.locator('.cube-row').count(),2);
  const row=page.locator('.cube-row').filter({has:page.getByRole('heading',{name:'Westerns since 1985',exact:true})});await row.getByRole('button',{name:'Edit cube',exact:true}).click();
  await next();assert.equal(await page.locator('#cube-rule-yearFrom').inputValue(),'1985');await page.locator('#cube-rule-yearFrom').fill('1995');
  await page.getByRole('button',{name:'Cancel',exact:true}).last().click();assert.equal(writes,1);assert.equal(doc.rows[1].filters.yearFrom,'1985');
  await row.getByRole('button',{name:'Edit cube',exact:true}).click();await next();await page.locator('#cube-rule-yearFrom').fill('1995');await next();await page.locator('#cube-confirm').click();await page.locator('#cube-naming').waitFor({state:'hidden'});
  assert.equal(writes,2);assert.equal(doc.rows[1].id,created.id);assert.equal(doc.rows[1].filters.yearFrom,'1995');
  report.checks.push('reopen restores query; cancel does not change it; edit updates same cube ID without replacing library');
  await page.locator('#cube-add').click();await next();await next();await page.locator('#cube-name').fill('Not saved');mode='refuse';await page.locator('#cube-confirm').click();await page.waitForFunction(()=>document.querySelector('#cube-builder-feedback').textContent.includes('refused'));
  assert.equal(doc.rows.length,2);assert.equal(await page.locator('#cube-name').inputValue(),'Not saved');mode='normal';await page.getByRole('button',{name:'Cancel',exact:true}).last().click();
  report.checks.push('refused write leaves draft intact and does not report saved');
  await page.locator('#cube-add').click();await next();await next();await page.locator('#cube-name').fill('Landed but response lost');mode='lost';const writesBefore=writes;await page.locator('#cube-confirm').click();
  await page.waitForFunction(()=>document.getElementById('cube-reconcile')&&!document.getElementById('cube-reconcile').hidden);assert.equal(writes,writesBefore+1);assert.equal(await page.locator('#cube-confirm').isDisabled(),true);
  assert.equal(await page.locator('#cube-reconcile').evaluate(el=>document.querySelector('#cube-naming').contains(el)),true,'Uncertain-save recovery must be inside the active modal, not behind its inert backdrop');mode='normal';denyReads=0;await page.locator('#cube-reconcile').click();await page.locator('#cube-naming').waitFor({state:'hidden'});assert.equal(writes,writesBefore+1);assert.equal(doc.rows.filter(r=>r.name==='Landed but response lost').length,1);
  report.checks.push('lost response remains unconfirmed; readback reconciles landed save without a repeated POST');
  await page.locator('#cube-add').click();await next();await next();await page.locator('#cube-name').fill('Written but readback denied');mode='readback-denied';const beforeDenied=writes;await page.locator('#cube-confirm').click();
  await page.waitForFunction(()=>!document.getElementById('cube-reconcile').hidden);
  assert.equal(await page.locator('#cube-confirm').isDisabled(),true);assert.equal(writes,beforeDenied+1);
  assert.ok((await page.locator('#cube-builder-feedback').innerText()).includes('not confirmed'),'A denied GET after accepted write is unknown, not rejected save');
  mode='normal';await page.locator('#cube-reconcile').focus();await page.keyboard.press('Enter');await page.locator('#cube-naming').waitFor({state:'hidden'});
  assert.equal(writes,beforeDenied+1);assert.equal(doc.rows.filter(r=>r.name==='Written but readback denied').length,1);
  report.checks.push('accepted write with refused readback stays uncertain; keyboard reconciliation reads only and never repeats the write');
  await page.locator('#cube-add').click();await next();await page.setViewportSize({width:320,height:480});assert.equal(await page.evaluate(()=>document.querySelector('#cube-naming').scrollWidth>document.querySelector('#cube-naming').clientWidth+1),false);
  await next();await page.locator('#cube-name').fill('Keyboard cancel');await page.keyboard.press('Escape');await page.locator('#cube-naming').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>document.activeElement?.id),'cube-add');assert.equal(doc.rows.length,4);
  report.checks.push('short narrow wizard remains scrollable; Escape cancels and returns focus to trigger');
  await page.setViewportSize({width,height:900});await page.locator('#cube-add').click();await next();await page.screenshot({path:path.join(out,`cube-builder-${width}.png`)});
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.unexpectedWrites,[]);report.pass=true;report.cubeWrites=writes;
 }catch(e){report.pass=false;report.error=e.stack;await page.screenshot({path:path.join(out,`failure-${width}.png`)}).catch(()=>{});}
 finally{await ctx.close();console.log(JSON.stringify(report));}
}}finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(reports,null,2));}
process.exitCode=reports.every(x=>x.pass)?0:1;
})().catch(e=>{console.error(e);process.exitCode=1;});

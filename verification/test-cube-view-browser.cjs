"use strict";
// Actual browser + actual Movie Night filter_cubes.py HTTP/CAS/file persistence.
// Test-only DOM host, synthetic row, no provider/Nuvio/Aries/player side effects.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {spawn} = require("node:child_process");
const {createInterface} = require("node:readline");
const {chromium} = require(process.env.MOVIE_NIGHT_PLAYWRIGHT || "playwright");

const root = path.resolve(__dirname, "..");
const report = {schema:"movie-night.cube-view-browser-acceptance/v1",
  evidence:"Disposable HTTP production filter_cubes.py plus production UI module in Chromium, synthetic user state",
  checks:[], forbiddenWrites:0, sourceSha:null};
const digest = data => require("node:crypto").createHash("sha256").update(data).digest("hex");
report.sourceSha = digest(fs.readFileSync(path.join(root,"web/filter-cubes.mjs")));

let fixture, browser, context, base, stderr="";
function record(name, observed) {
  report.checks.push({name,status:"PASS",observed});
  console.log("PASS " + name + " " + JSON.stringify(observed));
}
async function startFixture() {
  fixture = spawn(process.env.MOVIE_NIGHT_PYTHON || "python3",
    ["-u",path.join(__dirname,"cube-persistence-fixture.py")],
    {cwd:root,stdio:["ignore","pipe","pipe"]});
  fixture.stderr.on("data", chunk => {stderr += chunk.toString().slice(0,20000);});
  const lines = createInterface({input:fixture.stdout});
  const started = new Promise((resolve,reject)=>{
    lines.once("line",line=>{try{resolve(JSON.parse(line));}catch(e){reject(e);}});
    fixture.once("exit",(code)=>reject(new Error("Fixture exited "+code+": "+stderr)));
    fixture.once("error",reject);
  });
  const info = await Promise.race([started,new Promise((_,reject)=>setTimeout(
    ()=>reject(new Error("Fixture startup timeout: "+stderr)),15000))]);
  assert.equal(info.schema,"movie-night.cube-persistence-fixture/v1");
  return info.url;
}
const json = async () => {
  const response = await fetch(base+"/api/filter-cubes",{cache:"no-store"});
  assert.equal(response.status,200);
  return response.json();
};
async function page() {
  const p=await context.newPage();
  p.setDefaultTimeout(10000);
  p.on("request",r=>{
    if(r.method()!=="GET" && !(r.method()==="POST" && new URL(r.url()).pathname==="/api/filter-cubes")) report.forbiddenWrites++;
  });
  p.on("pageerror",e=>console.error("PAGE_ERROR "+e.message));
  await p.goto(base+"/fixture");
  await p.waitForFunction(()=>window.ready===true);
  return p;
}
async function mode(p, expected) {
  assert.equal(await p.locator("#cube-view-wall").getAttribute("aria-pressed"),String(expected==="wall"));
  assert.equal(await p.locator("#cube-view-carousel").getAttribute("aria-pressed"),String(expected==="carousel"));
  assert.equal(await p.locator("#film-grid").evaluate(e=>e.hidden),expected==="carousel");
  assert.equal(await p.locator("#cube-home").evaluate(e=>e.hidden),expected==="wall");
  assert.equal(await p.evaluate(()=>window.unexpectedEffects),0);
}
async function clickAndReject(name, respond, expectedError) {
  const p=await page();
  try{
    await mode(p,"wall");
    await p.route("**/api/filter-cubes",async route=>{
      if(route.request().method()==="POST") return respond(route);
      return route.continue();
    });
    await p.locator("#cube-view-carousel").click();
    await p.waitForFunction(message=>document.querySelector("#cube-status").textContent.includes(message),expectedError);
    await mode(p,"wall");
    const saved=await json();
    assert.equal(saved.view,"wall");
    assert.equal(saved.selected_id,"cube-a");
    await p.reload();
    await p.waitForFunction(()=>window.ready===true);
    await mode(p,"wall");
    record(name,{response:"rejected",savedRevision:saved.revision,visible:"wall",reopened:"wall"});
  }finally{await p.close();}
}
async function main(){
  base=await startFixture();
  browser=await chromium.launch({headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
  context=await browser.newContext({viewport:{width:1024,height:768},serviceWorkers:"block"});
  const initial=await json();
  assert.equal(initial.revision,1);
  assert.equal(initial.view,"wall");
  assert.equal(initial.selected_id,"cube-a");
  assert.equal(initial.rows[0].name,"Synthetic starting cube");
  record("actual backend initial document",{revision:initial.revision,view:initial.view,selected:initial.selected_id});

  await clickAndReject("HTTP 503 keeps visible view and independent reopen",
    route=>route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Backend unavailable"})}),
    "Backend unavailable");
  await clickAndReject("network failure keeps visible view and independent reopen",
    route=>route.abort("failed"),"Failed to fetch");

  // External writer legitimately advances revision while the browser has old state.
  const stale=await page();
  try{
    const before=await json();
    const competing={...before,rows:[{...before.rows[0],name:"Synthetic concurrent update"}]};
    const response=await fetch(base+"/api/filter-cubes",{method:"POST",
      headers:{"Content-Type":"application/json","X-Movie-Night":"1"},
      body:JSON.stringify(competing)});
    assert.equal(response.status,200);
    const newer=await response.json();
    assert.equal(newer.revision,before.revision+1);
    await stale.locator("#cube-view-carousel").click();
    await stale.waitForFunction(()=>document.querySelector("#cube-status").textContent.includes("changed in another window"));
    await mode(stale,"wall");
    assert.equal((await json()).rows[0].name,"Synthetic concurrent update");
    await stale.reload();
    await stale.waitForFunction(()=>window.ready===true);
    await mode(stale,"wall");
    record("real server CAS conflict keeps UI and preserves concurrent writer",
      {serverRevision:newer.revision,view:"wall",name:newer.rows[0].name});
  }finally{await stale.close();}

  const success=await page();
  try{
    const before=await json();
    await success.locator("#cube-view-carousel").click();
    await success.waitForFunction(()=>document.querySelector("#cube-view-carousel").getAttribute("aria-pressed")==="true");
    await mode(success,"carousel");
    const saved=await json();
    assert.equal(saved.revision,before.revision+1);
    assert.equal(saved.view,"carousel");
    assert.equal(saved.selected_id,"cube-a");
    assert.equal(saved.rows[0].id,"cube-a");
    await success.reload();
    await success.waitForFunction(()=>window.ready===true);
    await mode(success,"carousel");
    assert.equal((await json()).revision,saved.revision);
    record("real persisted save and page reopen preserve view and selected cube",
      {revision:saved.revision,view:saved.view,selected:saved.selected_id});
    await success.locator("#cube-view-wall").click();
    await success.waitForFunction(()=>document.querySelector("#cube-view-wall").getAttribute("aria-pressed")==="true");
    await mode(success,"wall");
    const returned=await json();
    assert.equal(returned.revision,saved.revision+1);
    await success.reload();
    await success.waitForFunction(()=>window.ready===true);
    await mode(success,"wall");
    record("reverse mode persists across a second reopen",
      {revision:returned.revision,view:returned.view,selected:returned.selected_id});
  }finally{await success.close();}

  const pending=await page();
  try{
    let release;
    let notify;
    const gate=new Promise(resolve=>{release=resolve;});
    const attempted=new Promise(resolve=>{notify=resolve;});
    await pending.route("**/api/filter-cubes",async route=>{
      if(route.request().method()==="POST"){
        notify();
        await gate;
      }
      return route.continue();
    });
    await pending.locator("#cube-view-carousel").click();
    await attempted;
    await mode(pending,"wall");
    assert.equal(await pending.locator("#cube-view-carousel").isDisabled(),true);
    release();
    await pending.waitForFunction(()=>document.querySelector("#cube-view-carousel").getAttribute("aria-pressed")==="true");
    await mode(pending,"carousel");
    record("pending request does not display unsaved view",{pending:"wall",afterConfirmation:"carousel"});
  }finally{await pending.close();}

  assert.equal(report.forbiddenWrites,0);
  record("zero unrelated or playback writes",{forbiddenWrites:report.forbiddenWrites});
}
(async()=>{try{await main();report.pass=true;}catch(error){
  report.pass=false;report.error=error.stack||String(error); console.error(error);
  process.exitCode=1;
}finally{
  await context?.close().catch(()=>{});
  await browser?.close().catch(()=>{});
  fixture?.kill("SIGTERM");
  const folder=process.env.MOVIE_NIGHT_TEST_OUTPUT || path.join(os.tmpdir(),"movie-night-cube-view-results");
  fs.mkdirSync(folder,{recursive:true});
  fs.writeFileSync(path.join(folder,"cube-view-browser.json"),JSON.stringify(report,null,2)+"\n");
  console.log("RESULT "+JSON.stringify({pass:report.pass,checks:report.checks.length,report:path.join(folder,"cube-view-browser.json")}));
}})();

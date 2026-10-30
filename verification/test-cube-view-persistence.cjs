"use strict";
// Behavior of the production switchMode function, with persistence and DOM effects isolated.
// SOURCE UNIT ONLY: not a browser, native app, BINS, or installed-Aries qualification.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "web", "filter-cubes.mjs"), "utf8");
const marker = "  async function switchMode(next) {";
const start = source.indexOf(marker);
const end = source.indexOf("  function openNaming(", start);
assert.ok(start >= 0 && end > start, "production switchMode boundary must be found exactly");
const productionFunction = source.slice(start, end);

async function exercise(result) {
  const context = { result };
  const program = `(async () => {
    let record = {view:"wall",selected_id:"cube-a",revision:4,rows:[{id:"cube-a"}]};
    let mode = "wall", busy = false, draft = null, activeId = "cube-a", queryEdit = null;
    const calls = {controls:0,rows:0,activate:0,playback:0};
    const updateControls = () => { calls.controls++; };
    const renderRows = () => { calls.rows++; };
    const data = () => record;
    const activate = () => { calls.activate++; };
    const commit = async next => {
      if (result !== "success") return false;
      record = {...next,revision:5};
      return true;
    };
    ${productionFunction}
    await switchMode("carousel");
    const after = {mode,persisted:record.view,selected:record.selected_id,revision:record.revision,calls:{...calls}};
    // New page/reopen reads the persisted document, not transient DOM state.
    const reopened = {mode:record.view,selected:record.selected_id};
    return {after,reopened};
  })()`;
  return await vm.runInNewContext(program, context, {timeout:1000});
}

for (const reason of ["revision_conflict_409", "unavailable_503", "network_failure"]) {
  test("rejected mode save retains previous visible and persisted view: " + reason, async () => {
    const {after,reopened} = await exercise(reason);
    assert.equal(after.mode, "wall");
    assert.equal(after.persisted, "wall");
    assert.equal(after.selected, "cube-a");
    assert.equal(after.revision, 4);
    assert.deepEqual({...reopened}, {mode:"wall",selected:"cube-a"});
    assert.equal(after.calls.rows, 0);
    assert.equal(after.calls.playback, 0);
  });
}

test("successful confirmed save updates view and survives simulated reopen", async () => {
  const {after,reopened} = await exercise("success");
  assert.equal(after.mode, "carousel");
  assert.equal(after.persisted, "carousel");
  assert.equal(after.selected, "cube-a");
  assert.equal(after.revision, 5);
  assert.deepEqual({...reopened}, {mode:"carousel",selected:"cube-a"});
  assert.equal(after.calls.rows, 1);
  assert.equal(after.calls.playback, 0);
});

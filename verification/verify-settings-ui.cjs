"use strict";

// Exercise the deployed shell and wall with isolated, in-memory preferences.
// All API routes, all writes and the native bridge are intercepted before load.
// This proves UI behavior; it does not claim real native transparency or media playback.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.MOVIE_NIGHT_PLAYWRIGHT || "/media/chrishallberg/Storage 22/999_Work/003_Projects/017_xi-io_inbox/node_modules/playwright");

const base = new URL(process.env.MOVIE_NIGHT_URL || "http://127.0.0.1:8789");
assert.equal(base.protocol, "http:");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(base.hostname) && !base.username && !base.password, "Use the local Movie Night service");
const output = path.resolve(process.argv[2] || path.join(__dirname, "settings-ui-results"));
const clone = (value) => JSON.parse(JSON.stringify(value));
const viewports = [{ name: "desktop", width: 1280, height: 900 }, { name: "tablet", width: 768, height: 1024 }];

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function bounded(promise, message, milliseconds = 10000) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); })]); }
  finally { clearTimeout(timer); }
}

function initialRecord() {
  return { revision: 7, settings: {
    appearance: { mode: "glass", opacity: 77 },
    browsing: { start_view: "curated", catalog: "imdbRating", card_size: "large", show_ratings: false },
    playback: { preferred_quality: "1080p", prefer_small_encodes: false, default_volume: 65, seek_seconds: 30 },
    plugins: { torrentio_enabled: true, cinemeta_enabled: true, ollama_enabled: true },
    concierge: { model: "saved-missing:latest" },
  } };
}

async function begin(browser, viewport, mode) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: "reduce", serviceWorkers: "block" });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(30000);
  const result = { mode, viewport, pass: false, checks: [], screenshots: [], settingsReads: 0, mockedSettingsWrites: [],
    blockedMutations: [], playerReads: 0, playerWrites: [], unexpectedAPI: [], pageErrors: [] };
  const state = { record: initialRecord(), readGate: mode === "complete" ? deferred() : null, saveGate: null,
    saveStarted: null, nextWrite: "ok", failInitialRead: mode === "load-error", modelsAvailable: true };
  const releases = [];
  if (state.readGate) releases.push(state.readGate);
  page.on("pageerror", (error) => result.pageErrors.push(error.message));
  await context.addInitScript(() => {
    const nativeState = { maximized: false, fullscreen: false, focused: true, transparency: { available: true, reason: "verification-fixture" } };
    window.__MOVIE_NIGHT_NATIVE__ = true;
    window.__MOVIE_NIGHT_WINDOW_STATE__ = nativeState;
    window.__SETTINGS_NATIVE_CALLS__ = [];
    window.__TAURI_INTERNALS__ = { invoke: async (command, args) => {
      window.__SETTINGS_NATIVE_CALLS__.push({ command, action: args?.action || null });
      if (command === "native_movie_window" && args?.action === "state") return nativeState;
      if (command === "set_movie_viewport" || command === "set_movie_controls_height") return true;
      throw new Error("Native action blocked by settings verification");
    } };
  });
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const json = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    if (url.origin !== base.origin) return route.abort("blockedbyclient");
    if (url.pathname.startsWith("/api/player")) {
      if (["GET", "HEAD"].includes(method)) {
        result.playerReads += 1;
        return json({ client: "aries", state: "idle", title: "", imdb_id: "", position: 0, duration: 0, volume: 65, muted: false, fullscreen: false });
      }
      result.playerWrites.push({ method, path: url.pathname });
      return json({ error: "Playback blocked by settings verification" }, 403);
    }
    if (url.pathname === "/api/settings" && method === "GET") {
      result.settingsReads += 1;
      if (state.failInitialRead && request.frame() === page.mainFrame()) {
        state.failInitialRead = false;
        return json({ error: "Fixture settings read is unavailable.", code: "settings_unavailable" }, 503);
      }
      if (state.readGate) await state.readGate.promise;
      return json(clone(state.record));
    }
    if (url.pathname === "/api/settings" && method === "POST") {
      const payload = request.postDataJSON();
      result.mockedSettingsWrites.push(clone(payload));
      assert.equal(request.headers()["x-movie-night"], "1", "Settings writes require the existing request marker");
      assert.deepEqual(Object.keys(payload).sort(), ["revision", "settings"]);
      state.saveStarted?.resolve();
      if (state.saveGate) await state.saveGate.promise;
      const behavior = state.nextWrite;
      state.nextWrite = "ok";
      if (behavior === "error") return json({ error: "Fixture preferences could not be saved.", code: "settings_unavailable" }, 503);
      if (behavior === "conflict") {
        state.record.revision += 1;
        state.record.settings.browsing.card_size = "large";
        state.record.settings.appearance.opacity = 88;
        return json({ error: "Settings changed in another window.", code: "revision_conflict" }, 409);
      }
      if (payload.revision !== state.record.revision) return json({ error: "Settings changed in another window.", code: "revision_conflict" }, 409);
      state.record = { revision: state.record.revision + 1, settings: clone(payload.settings) };
      return json(clone(state.record));
    }
    if (!["GET", "HEAD"].includes(method)) {
      result.blockedMutations.push({ method, path: url.pathname });
      return json({ error: "Mutation blocked by settings verification" }, 403);
    }
    if (url.pathname === "/api/settings/plugins") {
      const settings = state.record.settings;
      return json({ revision: state.record.revision, selected_model: settings.concierge.model,
        models: state.modelsAvailable ? ["llama3.1:8b", "qwen2.5:7b"] : [],
        plugins: [
          { id: "torrentio", name: "Torrentio + Real-Debrid", enabled: settings.plugins.torrentio_enabled, configured: true, available: true, connection_checked: false, status: "configured", message: "Fixture configuration exists. No real connection was inspected." },
          { id: "cinemeta", name: "Cinemeta", enabled: settings.plugins.cinemeta_enabled, configured: true, available: true, connection_checked: false, status: "ready", message: "Fixture catalogue browsing is enabled." },
          { id: "ollama", name: "Ollama", enabled: settings.plugins.ollama_enabled, configured: state.modelsAvailable, available: state.modelsAvailable, connection_checked: state.modelsAvailable, status: state.modelsAvailable ? "ready" : "unavailable", message: "Fixture local model status." },
        ] });
    }
    const film = { id: "tt9100201", imdb_id: "tt9100201", type: "movie", title: "Settings fixture film", year: 1990, genres: ["Drama"], description: "Isolated interface verification.", runtime: "100 min", imdbRating: 7.5 };
    if (url.pathname === "/api/library.json") return json({ title: "Movie Night", collections: [{ id: "fixture-list", name: "Settings fixture", description: "Synthetic titles only.", movies: [film] }] });
    if (url.pathname === "/api/personal-library") return json({ favorites: [], recent: [], watched: [], collections: [] });
    if (url.pathname === "/api/catalogues") return json({ catalogues: [] });
    if (url.pathname === "/api/browse") return json({ movies: [film], has_more: false, next_skip: null });
    if (url.pathname === "/api/browse/meta") return json({ movie: film, source: "fixture" });
    if (url.pathname === "/api/concierge/status") return json({ available: true, model: "qwen2.5:7b" });
    if (url.pathname.startsWith("/api/")) {
      result.unexpectedAPI.push({ method, path: url.pathname });
      return json({ error: "Unspecified API blocked by verification" }, 403);
    }
    return route.continue();
  });
  const screenshot = async (name) => {
    const destination = path.join(output, `${mode}-${viewport.name}-${name}.png`);
    await page.screenshot({ path: destination, fullPage: false });
    result.screenshots.push(destination);
  };
  const open = async () => {
    await page.goto(`${base.origin}/studio`, { waitUntil: "domcontentloaded" });
    await page.locator(".native-settings-button").waitFor();
  };
  const checkSafety = async () => {
    await page.waitForFunction(() => document.getElementById("movie-wall")?.contentDocument?.getElementById("film-grid")?.getAttribute("aria-busy") === "false");
    assert.ok(result.playerReads > 0, "Player status reads were mocked");
    assert.deepEqual(result.playerWrites, [], "Settings must not start or modify playback");
    assert.deepEqual(result.blockedMutations, [], "No import, favorite, chat or unrelated write may be attempted");
    assert.deepEqual(result.unexpectedAPI, [], "All API traffic must match the fixture contract");
    assert.deepEqual(result.pageErrors, [], "No uncaught browser errors");
    const nativeCalls = await page.evaluate(() => window.__SETTINGS_NATIVE_CALLS__);
    assert.ok(nativeCalls.every(call => ["set_movie_viewport", "set_movie_controls_height"].includes(call.command) || (call.command === "native_movie_window" && call.action === "state")), "Only harmless mocked layout/state calls are allowed");
    result.mockedNativeCalls = nativeCalls.length;
  };
  return { context, page, result, state, releases, screenshot, open, checkSafety };
}

async function settled(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function appearance(page, material, opacity) {
  await page.waitForFunction(({ material, opacity }) => document.documentElement.dataset.windowMaterial === material
    && Math.abs(Number(document.documentElement.style.getPropertyValue("--movie-night-surface-opacity")) - opacity) < .001, { material, opacity });
  const wall = await page.locator("#movie-wall").elementHandle();
  const frame = await wall.contentFrame();
  await frame.waitForFunction(({ material, opacity }) => document.documentElement.dataset.windowMaterial === material
    && Math.abs(Number(document.documentElement.style.getPropertyValue("--movie-night-surface-opacity")) - opacity) < .001, { material, opacity });
}

async function section(dialog, name) {
  await dialog.getByRole("navigation", { name: "Settings sections" }).getByRole("button", { name, exact: true }).click();
}

async function expectCurrent(dialog, name) {
  await dialog.locator('nav [aria-current="page"]').filter({ hasText: name }).waitFor({ state: "visible" });
  assert.equal(await dialog.locator('nav [aria-current="page"]').innerText(), name);
}

async function completePass(browser, viewport) {
  const run = await begin(browser, viewport, "complete");
  const { page, result, state, releases, screenshot } = run;
  try {
    await run.open();
    await page.locator(".native-settings-button").click();
    const dialog = page.locator("#movie-settings");
    await dialog.waitFor({ state: "visible" });
    assert.equal(await dialog.locator("#setting-browsing-card_size").isDisabled(), true);
    assert.match(await dialog.innerText(), /Loading your preferences/);
    assert.equal(await dialog.locator('button[type="submit"]').isDisabled(), true);
    state.readGate.resolve(); state.readGate = null;
    await page.waitForFunction(() => document.getElementById("setting-browsing-card_size")?.value === "large" && !document.getElementById("setting-browsing-card_size").disabled);
    assert.equal(await dialog.locator("#setting-browsing-catalog").inputValue(), "imdbRating");
    assert.equal(await dialog.locator('button[type="submit"]').isDisabled(), true, "Late initial settings must not become unsaved defaults");
    assert.doesNotMatch(await dialog.locator(".movie-settings-footer").innerText(), /Unsaved changes/);
    await dialog.evaluate(element => { window.__SETTINGS_DIALOG_FIXTURE__ = element; });
    result.checks.push("Opening before the initial GET disables editing, then adopts persisted values without a false dirty state");

    await dialog.getByRole("button", { name: "Close settings", exact: true }).click();
    await page.locator(".window-settings-cog").click();
    await dialog.waitFor({ state: "visible" });
    assert.equal(await page.evaluate(() => window.__SETTINGS_DIALOG_FIXTURE__ === document.getElementById("movie-settings")), true);
    await expectCurrent(dialog, "Browsing");
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    await page.getByRole("button", { name: "File menu for Movie Night", exact: true }).click();
    await page.getByRole("menuitem", { name: /^Preferences/ }).click();
    await dialog.waitFor({ state: "visible" });
    assert.equal(await page.locator("dialog.movie-settings").count(), 1);
    assert.equal(await page.evaluate(() => window.__SETTINGS_DIALOG_FIXTURE__ === document.getElementById("movie-settings")), true);
    assert.equal(new URL(page.url()).pathname.replace(/\/$/, ""), "/studio");
    result.checks.push("Title cog, footer cog and File → Preferences open the same modal without navigating away");

    const search = dialog.getByRole("searchbox", { name: "Search Movie Night settings" });
    await search.fill("volume");
    await dialog.locator("#setting-playback-default_volume").waitFor();
    assert.equal(await dialog.locator("#settings-heading-browsing").count(), 0);
    await search.fill("not-a-real-setting-fixture");
    assert.match(await dialog.locator(".settings-empty").innerText(), /No matching settings/);
    await search.fill("");
    result.checks.push("Search finds settings across sections and has an honest empty state");

    await section(dialog, "Appearance");
    await appearance(page, "glass", .77);
    const opacity = dialog.locator("#setting-appearance-opacity");
    await opacity.focus(); await opacity.press("Home");
    await appearance(page, "glass", .60);
    await screenshot("appearance-preview");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    await appearance(page, "glass", .77);
    await page.locator(".native-settings-button").click();
    await section(dialog, "Appearance");
    assert.equal(await opacity.inputValue(), "77");
    await dialog.locator("#setting-appearance-mode").selectOption("solid");
    assert.equal(await opacity.isDisabled(), true);
    await appearance(page, "solid", .77);
    await dialog.getByRole("button", { name: "Close settings", exact: true }).click();
    await appearance(page, "glass", .77);
    await page.locator(".native-settings-button").click();
    await section(dialog, "Appearance");
    await opacity.focus(); await opacity.press("End");
    await appearance(page, "glass", .95);
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    await appearance(page, "glass", .77);
    assert.equal(result.mockedSettingsWrites.length, 0);
    result.checks.push("Appearance previews reach shell and wall; Cancel, close and Escape restore saved material/opacity without writing");

    const wall = await (await page.locator("#movie-wall").elementHandle()).contentFrame();
    await wall.evaluate(() => parent.postMessage({ type: "movie-night:context", view: "playback", collectionId: "fixture-list" }, location.origin));
    await settled(page);
    await page.locator(".native-settings-button").click();
    await expectCurrent(dialog, "Playback");
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    await wall.evaluate(() => parent.postMessage({ type: "movie-night:context", view: "browsing", collectionId: "fixture-list" }, location.origin));
    await settled(page);
    await page.getByRole("button", { name: "Ask @ibal", exact: true }).first().click();
    await page.getByRole("button", { name: "Close concierge", exact: true }).waitFor();
    await page.locator(".native-settings-button").click();
    await expectCurrent(dialog, "@ibal concierge");
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    await page.getByRole("button", { name: "Close concierge", exact: true }).click();
    await page.locator(".native-settings-button").click();
    await expectCurrent(dialog, "Browsing");
    await section(dialog, "@ibal concierge");
    await dialog.locator("#setting-concierge-model").waitFor();
    await page.waitForFunction(() => !document.getElementById("setting-concierge-model").disabled);
    const selectedMissing = dialog.locator('#setting-concierge-model option[value="saved-missing:latest"]');
    assert.equal(await selectedMissing.isDisabled(), true);
    assert.match(await selectedMissing.innerText(), /not installed/);
    const offered = await dialog.locator("#setting-concierge-model option:enabled").evaluateAll(options => options.map(option => option.value));
    assert.deepEqual(offered, ["llama3.1:8b", "qwen2.5:7b"]);
    await section(dialog, "Plugins & connections");
    await dialog.locator("#setting-plugins-ollama_enabled").click();
    await section(dialog, "@ibal concierge");
    assert.equal(await dialog.locator("#setting-concierge-model").isDisabled(), true);
    await section(dialog, "Plugins & connections");
    await dialog.locator("#setting-plugins-ollama_enabled").click();
    await section(dialog, "@ibal concierge");
    state.modelsAvailable = false;
    await dialog.getByRole("button", { name: "Check models", exact: true }).click();
    await page.waitForFunction(() => document.getElementById("setting-concierge-model")?.selectedOptions[0]?.textContent.includes("unverified"));
    assert.equal(await dialog.locator("#setting-concierge-model").isDisabled(), true);
    state.modelsAvailable = true;
    await dialog.getByRole("button", { name: "Check models", exact: true }).click();
    await page.waitForFunction(() => !document.getElementById("setting-concierge-model").disabled);
    await dialog.locator("#setting-concierge-model").selectOption("qwen2.5:7b");
    result.checks.push("Current playback/concierge context opens the relevant section; only installed models can be selected and unavailable checks stay explicit");

    await section(dialog, "Browsing");
    await dialog.locator("#setting-browsing-card_size").selectOption("compact");
    await dialog.locator("#setting-browsing-show_ratings").click();
    await section(dialog, "Playback");
    await dialog.locator("#setting-playback-seek_seconds").selectOption("5");
    const expected = clone(state.record.settings);
    expected.concierge.model = "qwen2.5:7b";
    expected.browsing.card_size = "compact";
    expected.browsing.show_ratings = true;
    expected.playback.seek_seconds = 5;
    state.saveGate = deferred(); releases.push(state.saveGate); state.saveStarted = deferred();
    await dialog.locator('button[type="submit"]').click();
    await bounded(state.saveStarted.promise, "Settings POST did not reach the isolated fixture");
    assert.equal(await dialog.locator("#setting-playback-seek_seconds").isDisabled(), true);
    assert.equal(await dialog.getByRole("button", { name: "Close settings", exact: true }).isDisabled(), true);
    await page.keyboard.press("Escape");
    assert.equal(await dialog.isVisible(), true, "In-flight save must finish before dialog close");
    state.saveGate.resolve(); state.saveGate = null;
    await dialog.locator(".settings-saved").waitFor();
    assert.deepEqual(state.record, { revision: 8, settings: expected });
    assert.deepEqual(result.mockedSettingsWrites[0], { revision: 7, settings: expected });
    assert.equal(await dialog.locator('button[type="submit"]').isDisabled(), true);
    await wall.waitForFunction(() => document.body.dataset.cardSize === "compact" && document.body.dataset.showRatings === "true" && document.getElementById("player-forward").textContent.includes("+5s"));
    await screenshot("saved-playback");
    await dialog.getByRole("button", { name: "Done", exact: true }).click();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".native-settings-button").click();
    await page.waitForFunction(() => document.getElementById("setting-browsing-card_size")?.value === "compact");
    assert.equal(await dialog.locator('button[type="submit"]').isDisabled(), true);
    result.checks.push("Save uses the read revision, disables edits until acknowledgement, updates wall controls, and survives a full reload through GET readback");

    await dialog.locator("#setting-browsing-card_size").selectOption("comfortable");
    state.nextWrite = "conflict";
    await dialog.locator('button[type="submit"]').click();
    const reload = dialog.getByRole("button", { name: "Reload current settings", exact: true });
    await reload.waitFor();
    assert.equal(await dialog.locator("#setting-browsing-card_size").inputValue(), "comfortable");
    assert.equal(await dialog.locator('button[type="submit"]').isDisabled(), true);
    await reload.click();
    await page.waitForFunction(() => document.getElementById("setting-browsing-card_size")?.value === "large");
    await appearance(page, "glass", .88);
    assert.equal(await dialog.locator('button[type="submit"]').isDisabled(), true);
    result.checks.push("Conflict preserves the unsaved draft, prevents stale retries and reloads the newer authoritative revision only on request");

    await dialog.locator("#setting-browsing-card_size").selectOption("compact");
    await section(dialog, "Appearance");
    await opacity.focus(); await opacity.press("Home");
    await appearance(page, "glass", .60);
    state.nextWrite = "error";
    await dialog.locator('button[type="submit"]').click();
    await dialog.locator(".settings-error").waitFor();
    assert.match(await dialog.locator(".settings-error").innerText(), /could not be saved/);
    assert.equal(await opacity.inputValue(), "60");
    assert.equal(await dialog.locator('button[type="submit"]').isEnabled(), true);
    assert.equal(state.record.settings.appearance.opacity, 88);
    await screenshot("save-error");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await appearance(page, "glass", .88);
    await page.locator(".native-settings-button").click();
    assert.equal(await dialog.locator("#setting-browsing-card_size").inputValue(), "large");
    assert.equal(await dialog.locator('button[type="submit"]').isDisabled(), true);
    result.checks.push("A failed save retains editable values and feedback; Cancel restores the saved record and appearance");

    await section(dialog, "Plugins & connections");
    await screenshot("plugins");
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    const bounds = await dialog.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1, "Dialog must fit this viewport");
    await run.checkSafety();
    result.pass = true;
  } catch (error) {
    result.error = error.message;
    try { await screenshot("failure"); } catch { /* Preserve original failure. */ }
  } finally {
    releases.forEach(gate => gate.resolve());
    await run.context.close();
  }
  return result;
}

async function loadErrorPass(browser) {
  const run = await begin(browser, viewports[0], "load-error");
  const { page, result } = run;
  try {
    await run.open();
    await page.locator(".native-settings-button").click();
    const dialog = page.locator("#movie-settings");
    const retry = dialog.getByRole("button", { name: "Try again", exact: true });
    await retry.waitFor();
    assert.equal(await dialog.locator("#setting-browsing-card_size").isDisabled(), true);
    assert.equal(await dialog.locator('button[type="submit"]').isDisabled(), true);
    await run.screenshot("initial-error");
    await retry.click();
    await page.waitForFunction(() => document.getElementById("setting-browsing-card_size")?.value === "large" && !document.getElementById("setting-browsing-card_size").disabled);
    assert.equal(await dialog.locator('button[type="submit"]').isDisabled(), true);
    assert.equal(result.mockedSettingsWrites.length, 0);
    result.checks.push("Initial read failure keeps controls disabled; explicit retry loads saved preferences without creating unsaved changes");
    await run.checkSafety();
    result.pass = true;
  } catch (error) {
    result.error = error.message;
    try { await run.screenshot("failure"); } catch { /* Preserve original failure. */ }
  } finally { await run.context.close(); }
  return result;
}

(async () => {
  fs.mkdirSync(output, { recursive: true, mode: 0o700 });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.MOVIE_NIGHT_CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
  const results = [];
  try {
    for (const viewport of viewports) results.push(await completePass(browser, viewport));
    results.push(await loadErrorPass(browser));
  } finally { await browser.close(); }
  const report = { schema: "movie-night.settings-ui-verification/v1", verified_at: new Date().toISOString(),
    pass: results.every(result => result.pass), baseUrl: base.origin,
    policy: "Actual deployed shell/wall assets; fresh browser contexts; all APIs mocked; settings POSTs handled only in memory; all other writes blocked; native capability and commands mocked. No real preferences, credentials, media or native window actions are used.",
    liveSettingsWrites: 0, livePlayerRequests: 0, mediaStarted: 0, results };
  const target = path.join(output, "report.json");
  fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ pass: report.pass, results: results.map(({ mode, viewport, pass, error }) => ({ mode, viewport: viewport.name, pass, error })), report: target, liveSettingsWrites: 0, livePlayerRequests: 0 }, null, 2));
  if (!report.pass) process.exitCode = 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });

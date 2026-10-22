"use strict";

// Loads the real wall and CSS. Every player API request and native command is mocked.
// This script must never control an actual movie or native player.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.MOVIE_NIGHT_PLAYWRIGHT || "/media/chrishallberg/Storage 22/999_Work/003_Projects/017_xi-io_inbox/node_modules/playwright");

const baseUrl = process.env.MOVIE_NIGHT_URL || "http://localhost:8789";
const output = path.resolve(process.argv[2] || path.join(__dirname, "ui-results"));
const viewports = [
  { name: "desktop", width: 1024, height: 768 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "phone", width: 390, height: 844 },
];

async function settle(page) {
  await page.waitForFunction(() => !document.getElementById("player-close").disabled);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function inspectDock(page, label) {
  const geometry = await page.evaluate(() => {
    const dock = document.getElementById("player-dock");
    const visible = (element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
    return {
      width: innerWidth, height: innerHeight,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
      dock: dock.getBoundingClientRect().toJSON(),
      buttons: [...dock.querySelectorAll("button")].filter(visible).map((element) => {
        const bounds = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return { id: element.id, width: bounds.width, height: bounds.height, left: bounds.left, right: bounds.right, background: style.backgroundColor, color: style.color };
      }),
    };
  });
  assert.equal(geometry.horizontalOverflow, false, `${label}: horizontal page overflow`);
  assert.ok(geometry.dock.left >= -1 && geometry.dock.right <= geometry.width + 1, `${label}: dock exceeds screen width`);
  for (const button of geometry.buttons) {
    assert.ok(button.width >= 43.5 && button.height >= 43.5, `${label}: ${button.id} hit area is ${button.width}x${button.height}`);
    assert.ok(button.left >= -1 && button.right <= geometry.width + 1, `${label}: ${button.id} extends beyond the screen`);
    const rgb = button.background.match(/[\d.]+/g)?.slice(0, 3).map(Number) || [];
    assert.ok(!(rgb.length === 3 && rgb.every((channel) => channel > 235)), `${label}: ${button.id} has a white default button background`);
  }
  return geometry;
}

async function verifyViewport(browser, viewport) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: "reduce" });
  page.setDefaultTimeout(15000);
  const errors = [];
  const posts = [];
  const blockedMutations = [];
  let statusRequests = 0;
  let status = { client: "aries", state: "paused", imdb_id: "tt0111161", title: "The Shawshank Redemption", position: 9, duration: 8520, volume: 70, muted: false, fullscreen: false };
  page.on("pageerror", (error) => errors.push(error.message));

  await page.addInitScript(() => {
    window.__MOVIE_NIGHT_NATIVE__ = true;
    window.__MOVIE_NIGHT_VERIFICATION__ = { commands: [], fullscreen: false, showPlayer: true };
    window.__TAURI__ = { core: { invoke: async (command, args) => {
      const mock = window.__MOVIE_NIGHT_VERIFICATION__;
      mock.commands.push({ command, args });
      if (command === "prepare_movie_player") return true;
      if (command === "show_movie_player") {
        if (!mock.showPlayer) return false;
        window.movieNightNativeMode?.(true);
        return true;
      }
      if (command === "show_movie_wall") { window.movieNightNativeMode?.(false); return true; }
      if (command === "toggle_movie_fullscreen") {
        mock.fullscreen = !mock.fullscreen;
        window.movieNightNativeFullscreen?.(mock.fullscreen);
        return mock.fullscreen;
      }
      if (command === "set_movie_controls_height") return true;
      throw new Error("Unexpected mocked native command");
    } } };
  });

  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const json = (data, code = 200) => route.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(data) });
    if (url.pathname.startsWith("/api/player/")) {
      if (request.method() === "GET" && url.pathname.endsWith("/status")) { statusRequests += 1; return json(status); }
      if (request.method() === "POST") {
        const payload = request.postDataJSON();
        posts.push({ path: url.pathname, payload, headers: request.headers() });
        if (url.pathname.endsWith("/play")) status = { ...status, state: "playing", imdb_id: payload.imdb_id, title: payload.title, position: 0 };
        else if (url.pathname.endsWith("/command")) {
          if (payload.command === "pause") status.state = "paused";
          else if (payload.command === "resume") status.state = "playing";
          else if (payload.command === "stop") status = { ...status, state: "idle", imdb_id: "", title: "", position: 0, duration: 0 };
          else if (payload.command === "skip") status.position = Math.max(0, status.position + payload.value);
          else if (payload.command === "seek") status.position = payload.value;
          else if (payload.command === "volume") status.volume = payload.value;
          else if (payload.command === "mute") status.muted = !status.muted;
          else if (payload.command === "fullscreen") status.fullscreen = !status.fullscreen;
          else return json({ error: "unexpected_mock_command" }, 400);
        } else return json({ error: "unexpected_mock_endpoint" }, 400);
        return json(status);
      }
      return json({ error: "player_endpoint_blocked_by_verification" }, 403);
    }
    // No other write request can leave the browser, including accidental form submits.
    if (!["GET", "HEAD"].includes(request.method())) {
      blockedMutations.push({ method: request.method(), path: url.pathname });
      return json({ error: "mutation_blocked_by_verification" }, 403);
    }
    return route.continue();
  });

  const shots = [];
  async function screenshot(name, dockOnly = false) {
    const destination = path.join(output, `${viewport.name}-${name}.png`);
    if (dockOnly) await page.locator("#player-dock").screenshot({ path: destination });
    else await page.screenshot({ path: destination, fullPage: false });
    shots.push(destination);
  }

  try {
    await page.goto(`${baseUrl}/?movie=tt0111161`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.getElementById("film-dialog").open && document.getElementById("play-on-aries-label").textContent === "Resume on Aries");
    assert.equal(posts.length, 0, "Opening the wall or ?movie details must not autoplay");
    await page.locator("#play-on-aries").scrollIntoViewIfNeeded();
    await screenshot("selected-film");
    await page.locator("#close-dialog").click();
    await settle(page);
    const pausedGeometry = await inspectDock(page, `${viewport.name} paused`);
    await screenshot("paused");

    // A native host refusing attachment must not produce a blank native view.
    await page.evaluate(() => { window.__MOVIE_NIGHT_VERIFICATION__.showPlayer = false; });
    await page.locator("#player-watch").click();
    await settle(page);
    assert.equal(await page.evaluate(() => document.body.classList.contains("native-player-mode")), false);
    assert.equal(posts.length, 0, "Watch must not mutate playback");
    await page.evaluate(() => { window.__MOVIE_NIGHT_VERIFICATION__.showPlayer = true; });
    await page.locator("#player-watch").click();
    await page.waitForFunction(() => document.body.classList.contains("native-player-mode"));
    await settle(page);
    const nativeGeometry = await inspectDock(page, `${viewport.name} native`);
    await screenshot("native-controls", true);
    await page.locator("#player-wall").click();
    await page.waitForFunction(() => !document.body.classList.contains("native-player-mode"));
    assert.equal(posts.length, 0, "Back to wall must not mutate playback");

    await page.locator("#player-dock").focus();
    await page.keyboard.press("Space");
    await page.waitForFunction(() => document.getElementById("player-toggle-label").textContent === "Pause");
    assert.equal(status.position, 9, "Resume must retain the current film position");
    assert.equal(posts.at(-1).payload.command, "resume");
    await page.keyboard.press("ArrowRight");
    await settle(page);
    assert.deepEqual(posts.at(-1).payload, { command: "skip", value: 10 });
    await page.keyboard.press("ArrowLeft");
    await settle(page);
    assert.deepEqual(posts.at(-1).payload, { command: "skip", value: -10 });
    const beforeFullscreen = posts.length;
    await page.keyboard.press("f");
    await page.waitForFunction(() => window.__MOVIE_NIGHT_VERIFICATION__.fullscreen === true);
    await settle(page);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => window.__MOVIE_NIGHT_VERIFICATION__.fullscreen === false);
    assert.equal(posts.length, beforeFullscreen, "Native fullscreen shortcuts must not send mpv commands");

    await page.locator("#film-search").focus();
    const beforeInputKeys = posts.length;
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("f");
    assert.equal(posts.length, beforeInputKeys, "Typing must not control playback");
    assert.equal(await page.evaluate(() => window.__MOVIE_NIGHT_VERIFICATION__.fullscreen), false);
    await page.locator("#film-search").fill("");

    // This stop is fulfilled by the mock route and cannot reach the real adapter.
    await page.locator("#player-close").click();
    await page.waitForFunction(() => document.getElementById("player-dock").hidden);
    assert.equal(posts.at(-1).payload.command, "stop");
    assert.equal(status.state, "idle");
    await page.locator(".device-badge").click();
    await page.waitForFunction(() => !document.getElementById("player-dock").hidden && document.getElementById("player-controls").hidden);
    const idleGeometry = await inspectDock(page, `${viewport.name} idle`);
    await screenshot("idle");
    const beforeIdleClose = posts.length;
    await page.locator("#player-close").click();
    await page.waitForFunction(() => document.getElementById("player-dock").hidden);
    assert.equal(posts.length, beforeIdleClose, "Idle dismissal must not send a playback command");
    const pollCount = statusRequests;
    await page.waitForFunction(() => !document.getElementById("film-dialog").open);
    await page.waitForTimeout(2300);
    assert.ok(statusRequests > pollCount, "A status poll must occur after dismissal");
    assert.equal(await page.locator("#player-dock").evaluate((element) => element.hidden), true, "Polling must not reopen dismissed controls");
    await screenshot("idle-dismissed");

    // Native fullscreen works without a loaded movie; still a mocked shell command.
    await page.evaluate(() => { document.activeElement?.blur(); document.getElementById("collection").focus(); });
    await page.keyboard.press("f");
    await page.waitForFunction(() => window.__MOVIE_NIGHT_VERIFICATION__.fullscreen === true);
    await settle(page);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => window.__MOVIE_NIGHT_VERIFICATION__.fullscreen === false);
    assert.equal(posts.length, beforeIdleClose, "Idle native fullscreen must not issue playback commands");

    assert.equal(posts.filter((entry) => entry.path.endsWith("/play")).length, 0, "Verification must not launch even a mocked new title");
    for (const entry of posts) {
      assert.equal(entry.headers["content-type"], "application/json");
      assert.equal(entry.headers["x-movie-night"], "1");
    }
    assert.deepEqual(blockedMutations, []);
    assert.deepEqual(errors, []);
    return { viewport, pass: true, mockedOnly: true, livePlayerRequests: 0, statusRequests, mockedCommands: posts.map((entry) => entry.payload), nativeCommands: await page.evaluate(() => window.__MOVIE_NIGHT_VERIFICATION__.commands), geometry: { paused: pausedGeometry, native: nativeGeometry, idle: idleGeometry }, screenshots: shots };
  } catch (error) {
    try { await screenshot("failure"); } catch { /* Preserve the original failure. */ }
    return { viewport, pass: false, error: error.message, mockedOnly: true, livePlayerRequests: 0, errors, blockedMutations, screenshots: shots };
  } finally {
    await page.close();
  }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.MOVIE_NIGHT_CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
  const results = [];
  try { for (const viewport of viewports) results.push(await verifyViewport(browser, viewport)); }
  finally { await browser.close(); }
  const report = { pass: results.every((result) => result.pass), baseUrl, mockPolicy: "All /api/player/* calls and Tauri commands are mocked. All other non-GET/HEAD requests are blocked.", results };
  fs.writeFileSync(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ pass: report.pass, results: results.map(({ viewport, pass, error }) => ({ viewport, pass, error })), report: path.join(output, "report.json"), livePlayerRequests: 0 }, null, 2));
  if (!report.pass) process.exitCode = 1;
})().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });

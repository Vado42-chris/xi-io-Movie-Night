"use strict";

// Live catalogue/library GETs, isolated browser storage, zero playback or library writes.
// Run on Aries; this script does not launch the native application or a media player.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.MOVIE_NIGHT_PLAYWRIGHT || "/media/chrishallberg/Storage 22/999_Work/003_Projects/017_xi-io_inbox/node_modules/playwright");

const base = new URL(process.env.MOVIE_NIGHT_URL || "http://127.0.0.1:8789");
assert.equal(base.protocol, "http:", "Use the existing local Movie Night HTTP server");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(base.hostname) && !base.username && !base.password, "Verification targets loopback only");
const output = path.resolve(process.argv[2] || path.join(__dirname, "browse-results"));
const viewports = [{ name: "desktop", width: 1280, height: 900 }, { name: "tablet", width: 768, height: 1024 }];
const query = process.env.MOVIE_NIGHT_TEST_SEARCH || "The Princess Bride";
const imdb = (movie) => movie.imdb_id || movie.imdbId || movie.id || "";
const title = (movie) => movie.title || movie.name || "";

async function verifyViewport(browser, viewport) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, reducedMotion: "reduce", serviceWorkers: "block" });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(30000);
  const result = { viewport, pass: false, checks: [], screenshots: [], mockedPlayerReads: 0, playbackWriteAttempts: [], blockedMutations: [], browseRequests: [], pageErrors: [] };
  page.on("pageerror", (error) => result.pageErrors.push(error.message));

  // BrowserContext routing includes the embedded wall and any accidental popup.
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const json = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    if (url.pathname.startsWith("/api/player")) {
      if (["GET", "HEAD"].includes(method)) {
        result.mockedPlayerReads += 1;
        return json({ client: "aries", state: "idle", title: "", imdb_id: "", position: 0, duration: 0, volume: 65, muted: false, fullscreen: false });
      }
      result.playbackWriteAttempts.push({ method, path: url.pathname });
      return json({ error: "playback_blocked_by_verification" }, 403);
    }
    if (!["GET", "HEAD"].includes(method)) {
      result.blockedMutations.push({ method, path: url.pathname });
      return json({ error: "mutation_blocked_by_verification" }, 403);
    }
    if (url.origin === base.origin && url.pathname === "/api/browse") {
      result.browseRequests.push({ type: url.searchParams.get("type"), skip: url.searchParams.get("skip"), search: url.searchParams.get("search") || "" });
    }
    return route.continue();
  });
  await context.addInitScript(() => {
    // A browser regression must never receive a real native-command binding.
    window.__MOVIE_NIGHT_NATIVE__ = false;
  });

  async function screenshot(name) {
    const destination = path.join(output, `${viewport.name}-${name}.png`);
    await page.screenshot({ path: destination, fullPage: false });
    result.screenshots.push(destination);
  }

  async function catalogue(action, type, search = null, skip = null) {
    const waiting = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.origin === base.origin && url.pathname === "/api/browse"
        && response.request().method() === "GET" && url.searchParams.get("type") === type
        && (search === null || (url.searchParams.get("search") || "") === search)
        && (skip === null || Number(url.searchParams.get("skip")) === skip);
    }, { timeout: 35000 });
    await action();
    const response = await waiting;
    assert.equal(response.status(), 200, `Live ${type} catalogue returned HTTP ${response.status()}`);
    const data = await response.json();
    assert.ok(Array.isArray(data.movies), "Catalogue response must contain movies[]");
    assert.ok(data.movies.length > 0, `Live ${type} catalogue returned no titles for this check`);
    return data;
  }

  try {
    const libraryResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/personal-library" && response.request().method() === "GET");
    await page.goto(`${base.origin}/studio`, { waitUntil: "domcontentloaded" });
    await page.locator("#movie-wall").waitFor();
    const handle = await page.locator("#movie-wall").elementHandle();
    const wall = await handle.contentFrame();
    assert.ok(wall, "The real Studio window must contain the movie-wall iframe");
    await wall.locator('#collection-picker option[value="browse-movie"]').waitFor({ state: "attached", timeout: 30000 });
    const libraryHTTP = await libraryResponse;
    assert.equal(libraryHTTP.status(), 200, "Live personal library API must be available");
    const library = await libraryHTTP.json();
    for (const key of ["favorites", "recent", "watched", "collections"]) assert.ok(Array.isArray(library[key]), `Personal library ${key} must be an array`);
    result.personalLibrary = { favorites: library.favorites.length, recent: library.recent.length, imported: library.collections.find((entry) => entry.id === "nuvio-library")?.movies?.length || 0 };
    assert.equal(await wall.locator(".site-header").isVisible(), false, "Studio should supply the only application header");
    assert.equal(await page.locator(".movie-pane-wrap .xi-window").count(), 1, "Use the real Studio WindowFrame");
    result.checks.push("Live personal-library read and embedded Studio frame");

    // Dismiss only the mocked idle controls, leaving room for the browse screenshots.
    await wall.locator("#player-close").click();
    const firstPage = await catalogue(() => wall.locator('[data-collection="browse-movie"]').click(), "movie", "", 0);
    await wall.waitForFunction(() => document.getElementById("film-grid").getAttribute("aria-busy") === "false" && document.querySelectorAll(".movie-tile").length > 0);
    assert.match(await wall.locator("#filter-scope").textContent(), /loaded titles, not the entire catalogue/);
    const grid = await wall.locator("#film-grid").boundingBox();
    const frame = await page.locator("#movie-wall").boundingBox();
    result.geometry = { firstPosterTop: grid?.y, frame, viewportWidth: viewport.width };
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, "Studio page must fit the viewport horizontally");
    await screenshot("browse");
    result.checks.push(`Live movie browse (${firstPage.movies.length} first-page records)`);

    if (firstPage.has_more === true && Number.isInteger(firstPage.next_skip)) {
      const more = await catalogue(() => wall.locator("#load-more").click(), "movie", "", firstPage.next_skip);
      await wall.waitForFunction(() => document.getElementById("film-grid").getAttribute("aria-busy") === "false");
      result.checks.push(`Live pagination uses next_skip=${firstPage.next_skip} (${more.movies.length} further records)`);
    } else result.checks.push("Pagination not offered by this live first page");

    await wall.locator("#catalog-search").fill(query);
    const searched = await catalogue(() => wall.locator("#catalog-search-button").click(), "movie", query, 0);
    await wall.waitForFunction(() => document.getElementById("film-grid").getAttribute("aria-busy") === "false");
    const reference = searched.movies.find((movie) => imdb(movie) === "tt0093779") || searched.movies.find((movie) => /^\d{4}/.test(String(movie.year || movie.releaseInfo || "")));
    assert.ok(reference && title(reference), "Search needs a real result with a known release year");
    const year = Number(String(reference.year || reference.releaseInfo).slice(0, 4));
    const referenceTitle = title(reference);
    const visible = async () => (await wall.locator(".movie-title").allTextContents()).includes(referenceTitle);
    assert.equal(await visible(), true, "Live search result must appear on the wall");
    result.checks.push(`Live catalogue search: ${query}`);

    const browseReadsBeforeFilters = result.browseRequests.length;
    await wall.locator("#open-filters").click();
    await wall.locator("#filter-year-from").fill(String(year));
    await wall.locator("#filter-year-to").fill(String(year));
    assert.equal(await visible(), true, "Equal inclusive year bounds retain the matching title");
    await wall.locator("#filter-year-from").fill(String(year + 1));
    assert.equal(await wall.locator("#apply-filters").isDisabled(), true, "Inverted year range must not apply");
    await wall.locator("#filter-year-to").fill(String(year + 1));
    assert.equal(await visible(), false, "A title outside the selected year is hidden");
    await wall.locator("#reset-advanced-filters").click();
    result.checks.push("Inclusive year boundaries and invalid-range feedback");

    const genres = Array.isArray(reference.genres) ? reference.genres : [];
    if (genres.length) {
      const first = genres[0];
      const other = ["Horror", "Western", "Crime", "Documentary"].find((name) => !genres.some((genre) => genre.toLowerCase() === name.toLowerCase()));
      const choice = (kind, genre) => wall.locator(`#${kind}-genres input[value=${JSON.stringify(genre)}]`);
      await choice("include", first).check();
      if (other) {
        await choice("include", other).check();
        await wall.locator("#filter-genre-mode").selectOption("all");
        assert.equal(await visible(), false, "All included genres must match");
        await wall.locator("#filter-genre-mode").selectOption("any");
        assert.equal(await visible(), true, "Any included genre can match");
      }
      await wall.locator(".exclude-genres > summary").click();
      await choice("exclude", first).check();
      assert.equal(await visible(), false, "An excluded genre removes its title");
      await wall.locator("#reset-advanced-filters").click();
      result.checks.push("Include genres: Any/All, and explicit exclusion");
    } else result.checks.push("Live search metadata had no genres; genre assertion skipped");

    const rating = Number(reference.imdbRating ?? reference.rating ?? reference.imdb_rating);
    if (Number.isFinite(rating) && rating > 0 && rating < 10) {
      await wall.locator("#filter-rating").evaluate((element) => { element.value = "10"; element.dispatchEvent(new Event("input", { bubbles: true })); });
      assert.equal(await visible(), false, "Minimum rating hides a lower-rated title");
      await wall.locator("#reset-advanced-filters").click();
      result.checks.push("Minimum rating uses the live record");
    }
    await wall.locator("#filter-runtime").fill("1");
    assert.equal(await visible(), false, "One-minute maximum hides a feature or unknown runtime");
    await wall.locator("#reset-advanced-filters").click();
    await wall.locator("#filter-type").selectOption("series");
    assert.equal(await wall.locator(".movie-tile").count(), 0, "Movie catalogue results do not become TV series");
    await wall.locator("#reset-advanced-filters").click();
    assert.equal(result.browseRequests.length, browseReadsBeforeFilters, "Advanced filters must use loaded records without provider-wide requests");
    result.checks.push("Maximum runtime, type filter, and loaded-results-only scope");

    await wall.locator("#filter-year-from").fill(String(year));
    await wall.locator("#filter-year-to").fill(String(year));
    await wall.locator("#saved-view-name").fill("Verification view (isolated browser)");
    await wall.locator("#save-view").click();
    await wall.locator("#reset-advanced-filters").click();
    await wall.locator("#saved-views").selectOption("0");
    assert.equal(await wall.locator("#filter-year-from").inputValue(), String(year));
    assert.equal(await visible(), true);
    // No profile or user browser storage is opened; this context is discarded below.
    await wall.locator(".filter-scroll").evaluate((element) => { element.scrollTop = 0; });
    await screenshot("filter-drawer");
    await wall.locator("#reset-advanced-filters").click();
    await wall.locator("#apply-filters").click();
    result.checks.push("Saved filter view round trip in isolated localStorage");

    await catalogue(() => wall.locator('[data-collection="browse-series"]').click(), "series", "", 0);
    await wall.waitForFunction(() => document.getElementById("film-grid").getAttribute("aria-busy") === "false" && document.querySelectorAll(".movie-tile").length > 0);
    await wall.locator(".movie-card").first().click();
    assert.equal(await wall.locator("#play-on-aries").isDisabled(), true, "Series details must disable movie playback");
    assert.match(await wall.locator("#playback-feedback").textContent(), /Episode playback not connected yet/);
    await wall.locator("#close-dialog").click();
    result.checks.push("Live TV browse and episode-playback guard");
    assert.ok(result.mockedPlayerReads > 0, "Player status must be mocked during this check");
    assert.deepEqual(result.playbackWriteAttempts, [], "Browsing must not attempt any playback write");
    assert.deepEqual(result.blockedMutations, [], "Verification must not attempt favorites, import, collection, or chat writes");
    assert.deepEqual(result.pageErrors, [], "No uncaught browser errors");
    result.pass = true;
  } catch (error) {
    result.error = error.message;
    try { await screenshot("failure"); } catch { /* Preserve the original result. */ }
  } finally { await context.close(); }
  return result;
}

(async () => {
  fs.mkdirSync(output, { recursive: true, mode: 0o700 });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.MOVIE_NIGHT_CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
  const results = [];
  try { for (const viewport of viewports) results.push(await verifyViewport(browser, viewport)); }
  finally { await browser.close(); }
  const report = { pass: results.every((result) => result.pass), baseUrl: base.origin,
    policy: "Live browse/library GETs; all player GETs mocked; every playback and other write request blocked; isolated browser storage; no native player launched.",
    livePlayerRequests: 0, results };
  fs.writeFileSync(path.join(output, "report.json"), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ pass: report.pass, results: results.map(({ viewport, pass, error }) => ({ viewport: viewport.name, pass, error })), report: path.join(output, "report.json"), livePlayerRequests: 0 }, null, 2));
  if (!report.pass) process.exitCode = 1;
})().catch((error) => { console.error(error.message); process.exitCode = 1; });

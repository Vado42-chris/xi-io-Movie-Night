"use strict";

// Run on Aries against the existing Movie Night service. This verifies the
// expanded catalogue controls, not native transparency or real media playback.
// Each pass has fresh browser storage. Player reads and settings defaults are
// mocked before navigation; every write is blocked, including from the wall.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.MOVIE_NIGHT_PLAYWRIGHT || "/media/chrishallberg/Storage 22/999_Work/003_Projects/017_xi-io_inbox/node_modules/playwright");

const base = new URL(process.env.MOVIE_NIGHT_URL || "http://127.0.0.1:8789");
assert.equal(base.protocol, "http:", "Use the existing local Movie Night HTTP service");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(base.hostname) && !base.username && !base.password,
  "Verification targets loopback only");
const output = path.resolve(process.argv[2] || path.join(__dirname, "expanded-browse-results"));
const viewports = [{ name: "desktop", width: 1280, height: 900 }, { name: "tablet", width: 768, height: 1024 }];
const searchQuery = "The Princess Bride";
const defaultSettings = {
  revision: 0,
  settings: {
    appearance: { mode: "glass", opacity: 82 },
    browsing: { start_view: "curated", catalog: "top", card_size: "comfortable", show_ratings: true },
    playback: { preferred_quality: "balanced", prefer_small_encodes: true, default_volume: 100, seek_seconds: 10 },
    plugins: { torrentio_enabled: true, cinemeta_enabled: true, ollama_enabled: true },
    concierge: { model: "llama3.1:8b" },
  },
};

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function bounded(promise, label, milliseconds = 10000) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(label)), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

function requestShape(url) {
  return { type: url.searchParams.get("type") || "movie", catalog: url.searchParams.get("catalog") || "top",
    genre: url.searchParams.get("genre") || "", search: url.searchParams.get("search") || "",
    skip: Number(url.searchParams.get("skip") || 0) };
}

function matches(shape, wanted) {
  return Object.entries(wanted).every(([key, value]) => shape[key] === value);
}

async function ready(wall) {
  await wall.waitForFunction(() => document.getElementById("film-grid")?.getAttribute("aria-busy") === "false");
}

async function framesSettled(wall) {
  await wall.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function catalogue(page, wall, action, wanted) {
  const responsePending = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.origin === base.origin && url.pathname === "/api/browse"
      && response.request().method() === "GET" && matches(requestShape(url), wanted);
  }, { timeout: 35000 });
  await action();
  const response = await responsePending;
  assert.equal(response.status(), 200, `Catalogue ${JSON.stringify(wanted)} returned HTTP ${response.status()}`);
  const data = await response.json();
  assert.ok(Array.isArray(data.movies), "Catalogue response requires movies[]");
  await ready(wall);
  return data;
}

async function begin(browser, viewport, mode, mockRoute) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height },
    reducedMotion: "reduce", serviceWorkers: "block" });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(30000);
  const result = { mode, viewport, pass: false, checks: [], screenshots: [], mockedPlayerReads: 0, mockedSettingsReads: 0,
    playbackWriteAttempts: [], blockedMutations: [], browseRequests: [], metadataRequests: [], pageErrors: [] };
  page.on("pageerror", (error) => result.pageErrors.push(error.message));
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const json = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    if (url.pathname.startsWith("/api/player")) {
      if (["GET", "HEAD"].includes(method)) {
        result.mockedPlayerReads += 1;
        return json({ client: "aries", state: "idle", title: "", imdb_id: "", position: 0, duration: 0,
          volume: 65, muted: false, fullscreen: false });
      }
      result.playbackWriteAttempts.push({ method, path: url.pathname });
      return json({ error: "playback_blocked_by_verification" }, 403);
    }
    if (!["GET", "HEAD"].includes(method)) {
      result.blockedMutations.push({ method, path: url.pathname });
      return json({ error: "mutation_blocked_by_verification" }, 403);
    }
    if (url.origin === base.origin) {
      // Both Studio and its iframe see the same deterministic read-only
      // defaults. Persisted preferences must not choose this test's first view.
      if (url.pathname === "/api/settings") {
        result.mockedSettingsReads += 1;
        return json(defaultSettings);
      }
      if (url.pathname === "/api/browse") result.browseRequests.push(requestShape(url));
      if (url.pathname === "/api/browse/meta") result.metadataRequests.push({ type: url.searchParams.get("type"), id: url.searchParams.get("id") });
      if (mockRoute && await mockRoute({ route, request, url, json })) return;
    }
    return route.continue();
  });
  await context.addInitScript(() => { window.__MOVIE_NIGHT_NATIVE__ = false; });
  const screenshot = async (name) => {
    const destination = path.join(output, `${mode}-${viewport.name}-${name}.png`);
    await page.screenshot({ path: destination, fullPage: false });
    result.screenshots.push(destination);
  };
  const open = async () => {
    await page.goto(`${base.origin}/studio`, { waitUntil: "domcontentloaded" });
    const element = await page.locator("#movie-wall").elementHandle();
    assert.ok(element, "Studio must host the real wall iframe");
    const wall = await element.contentFrame();
    assert.ok(wall, "Movie Night wall iframe must be available");
    await wall.locator('#collection-picker option[value="browse-movie"]').waitFor({ state: "attached", timeout: 30000 });
    await ready(wall);
    if (await wall.locator("#player-close").isVisible()) await wall.locator("#player-close").click();
    return wall;
  };
  const assertNoWrites = () => {
    assert.ok(result.mockedPlayerReads > 0, "Player reads must have been intercepted");
    assert.ok(result.mockedSettingsReads > 0, "Settings defaults must have been intercepted before navigation");
    assert.deepEqual(result.playbackWriteAttempts, [], "Browsing must not attempt playback writes");
    assert.deepEqual(result.blockedMutations, [], "No import, favorite, collection, settings, or chat write may be attempted");
    assert.deepEqual(result.pageErrors, [], "No uncaught browser errors");
  };
  return { context, page, result, open, screenshot, assertNoWrites };
}

async function livePass(browser, viewport) {
  const run = await begin(browser, viewport, "live");
  const { context, page, result, screenshot } = run;
  try {
    const directoryPending = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/catalogues");
    const wall = await run.open();
    const directoryHTTP = await directoryPending;
    assert.equal(directoryHTTP.status(), 200, "The local catalogue directory must be available");
    const directory = await directoryHTTP.json();
    assert.equal(directory.catalogues?.length, 6, "Directory should expose the six supported movie/TV feeds");
    assert.equal(new Set(directory.catalogues.map((item) => item.key)).size, 6, "Catalogue keys must be unique");
    assert.ok(directory.catalogues.every((item) => item.total === null), "Unknown provider totals must remain unknown");
    assert.ok(directory.genres?.series?.includes("Reality-TV"), "TV-specific catalogue genres must be available");
    result.directory = { source: directory.source, manifest_version: directory.manifest_version,
      manifest_verified_on: directory.manifest_verified_on, entries: directory.catalogues.length };
    result.checks.push("Live local directory exposes six distinct supported feeds and TV-specific genres");

    const popular = await catalogue(page, wall, () => wall.locator("#collection-picker").selectOption("browse-movie"),
      { type: "movie", catalog: "top", skip: 0, search: "" });
    assert.ok(popular.movies.length > 0, "Popular movies must render a nonempty live page");
    assert.deepEqual(await wall.locator("#catalog-source option").evaluateAll((options) => options.map((option) => option.value)),
      ["top", "imdbRating", "year"]);
    assert.match(await wall.locator("#filter-scope").textContent(), /loaded/i);
    result.checks.push("Live Popular movies render with catalogue controls");

    // The provider's cursor is authoritative even when sanitized pages contain
    // fewer rows. Reach an offset beyond the original 100-film collection.
    let continuation = popular;
    for (let index = 0; index < 2 && continuation.has_more; index += 1) {
      assert.ok(Number.isInteger(continuation.next_skip), "Provider continuation must be an integer");
      const requested = continuation.next_skip;
      continuation = await catalogue(page, wall, () => wall.locator("#load-more").click(),
        { type: "movie", catalog: "top", skip: requested, search: "" });
    }
    result.checks.push("Live continuation follows provider next_skip through up to three pages");

    const featured = await catalogue(page, wall, () => wall.locator("#catalog-source").selectOption("imdbRating"),
      { type: "movie", catalog: "imdbRating", skip: 0, search: "" });
    assert.ok(featured.movies.length > 0, "Featured movies must return a live page");
    await catalogue(page, wall, () => wall.locator("#catalog-genre").selectOption("Sci-Fi"),
      { type: "movie", catalog: "imdbRating", genre: "Sci-Fi", skip: 0, search: "" });
    assert.equal(await wall.locator("#catalog-genre").inputValue(), "Sci-Fi");
    result.checks.push("Featured and provider genre choices send distinct catalogue queries");

    await catalogue(page, wall, () => wall.locator("#catalog-source").selectOption("year"),
      { type: "movie", catalog: "year", skip: 0, search: "" });
    const yearPage = await catalogue(page, wall, () => wall.locator("#catalog-year").selectOption("1990"),
      { type: "movie", catalog: "year", genre: "1990", skip: 0, search: "" });
    assert.ok(yearPage.movies.length > 0, "The historical year selector must fetch real titles");
    assert.equal(await wall.locator("#catalog-year").isVisible(), true);
    assert.equal(await wall.locator("#catalog-genre").isVisible(), false);
    result.checks.push("Historical release-year list is fetched from the provider");
    await screenshot("by-year");

    await wall.locator("#catalog-search").fill(searchQuery);
    const searched = await catalogue(page, wall, () => wall.locator("#catalog-search-button").click(),
      { type: "movie", catalog: "top", genre: "", skip: 0, search: searchQuery });
    const knownMovie = searched.movies.find((movie) => movie.imdb_id === "tt0093779");
    assert.ok(knownMovie, "The live search must include The Princess Bride");
    assert.equal(await wall.locator("#catalog-source").inputValue(), "top");
    assert.equal(await wall.locator("#catalog-genre").inputValue(), "");
    result.checks.push("Searching from a year list switches to searchable Popular and clears its incompatible provider filter");

    const metadataPending = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === "/api/browse/meta" && url.searchParams.get("type") === "movie"
        && url.searchParams.get("id") === knownMovie.imdb_id;
    });
    await wall.getByRole("button", { name: `View details: ${knownMovie.title}${knownMovie.year ? ` (${knownMovie.year})` : ""}, movie`, exact: true }).click();
    const metadataHTTP = await metadataPending;
    assert.equal(metadataHTTP.status(), 200, "Opening a browse title must request available full metadata");
    const metadata = await metadataHTTP.json();
    await wall.waitForFunction((description) => document.getElementById("dialog-description").textContent === description,
      metadata.movie.description);
    assert.ok(metadata.movie.description, "Full metadata must supply this known title's description");
    await wall.locator("#close-dialog").click();
    result.checks.push("Browse details receive live full metadata without invoking playback");

    await catalogue(page, wall, () => wall.locator("#collection-picker").selectOption("browse-series"),
      { type: "series", catalog: "top", skip: 0, search: "" });
    assert.ok((await wall.locator("#catalog-genre option").evaluateAll((options) => options.map((option) => option.value))).includes("Reality-TV"));
    await catalogue(page, wall, () => wall.locator("#catalog-genre").selectOption("Reality-TV"),
      { type: "series", catalog: "top", genre: "Reality-TV", skip: 0, search: "" });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    assert.equal(await wall.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    await screenshot("tv-genre");
    result.checks.push("TV-specific genre browsing and horizontal fit at this viewport");
    run.assertNoWrites();
    result.pass = true;
  } catch (error) {
    result.error = error.message;
    try { await screenshot("failure"); } catch { /* Keep original failure. */ }
  } finally { await context.close(); }
  return result;
}

function fixtures() {
  const film = (id, title, type = "movie", year = 1990) => ({ imdb_id: id, id, type, title, year, genres: ["Drama"], runtime: "100 min", imdbRating: 7.5 });
  const a = film("tt9100001", "First fixture title");
  const b = film("tt9100002", "Second fixture title");
  const current = film("tt9100003", "Current year result");
  const stale = film("tt9100004", "Stale featured result");
  const directory = { schema: "movie-night.catalogues/v1", source: "Cinemeta", manifest_version: "fixture",
    manifest_verified_on: "synthetic", catalogues: [],
    genres: { movie: ["Drama", "Sci-Fi"], series: ["Drama", "Sci-Fi", "Reality-TV"] },
    years: { movie: [new Date().getUTCFullYear(), 1990], series: [new Date().getUTCFullYear(), 1990] } };
  for (const type of ["movie", "series"]) for (const [catalog, name] of [["top", "Popular"], ["imdbRating", "Featured"], ["year", "New"]]) {
    directory.catalogues.push({ key: `cinemeta-${type}-${catalog}`, type, catalog, name, catalog_name: name,
      params: { type, catalog, ...(catalog === "year" ? { genre: String(new Date().getUTCFullYear()) } : {}) },
      genre_options: catalog === "year" ? [] : directory.genres[type],
      year_options: catalog === "year" ? directory.years[type] : [], supports_search: catalog === "top", pagination: true, total: null });
  }
  const shared = { id: "shared-saved", name: "Shared saved collection", movies: [a] };
  const library = { title: "Movie Night verification", collections: [
    { id: "curated-fixture", name: "Fixture collection", movies: [a, b] }, shared,
  ] };
  const personal = { favorites: [], recent: [], watched: [], imported_at: "2026-10-22T00:00:00Z", collections: [
    { id: "nuvio-library", name: "Your Nuvio library", movies: [a, b] }, shared, { ...shared },
    { id: "private-fixture", name: "Private fixture collection", movies: [b] },
  ] };
  return { a, b, current, stale, directory, library, personal };
}

async function edgePass(browser, viewport) {
  const data = fixtures();
  const heldBrowse = { seen: deferred(), release: deferred(), done: deferred(), enabled: true };
  const heldMetadata = { seen: deferred(), release: deferred(), done: deferred(), enabled: true };
  const pageBody = (movies, shape, more = false, next = null) => ({ source: "Cinemeta", movies,
    has_more: more, next_skip: next, type: shape.type, catalog: shape.catalog, genre: shape.genre,
    search: shape.search, skip: shape.skip, page_size: 50 });
  const mockRoute = async ({ url, json }) => {
    if (url.pathname === "/api/catalogues") { await json(data.directory); return true; }
    if (url.pathname === "/api/library.json") { await json(data.library); return true; }
    if (url.pathname === "/api/personal-library") { await json(data.personal); return true; }
    if (url.pathname === "/api/browse") {
      const shape = requestShape(url);
      if (shape.catalog === "imdbRating" && heldBrowse.enabled) {
        heldBrowse.enabled = false;
        heldBrowse.seen.resolve();
        await heldBrowse.release.promise;
        try { await json(pageBody([data.stale], shape)); }
        catch { /* Aborted stale transport is an acceptable cancellation path. */ }
        finally { heldBrowse.done.resolve(); }
      } else if (shape.catalog === "year") await json(pageBody([data.current], shape));
      else if (shape.search) await json(pageBody([data.b], shape));
      else if (shape.skip === 0) await json(pageBody([], shape, true, 50));
      else if (shape.skip === 50) await json(pageBody([data.a, data.a, data.b], shape, true, 100));
      else await json(pageBody([data.b, data.current], shape));
      return true;
    }
    if (url.pathname === "/api/browse/meta") {
      const id = url.searchParams.get("id");
      const movie = [data.a, data.b, data.current].find((entry) => entry.imdb_id === id);
      if (!movie) { await json({ error: "Unknown fixture title" }, 404); return true; }
      if (id === data.a.imdb_id && heldMetadata.enabled) {
        heldMetadata.enabled = false;
        heldMetadata.seen.resolve();
        await heldMetadata.release.promise;
        try { await json({ source: "Cinemeta", movie: { ...movie, description: "Stale first-title metadata" } }); }
        catch { /* Closing the dialog may cancel the transport. */ }
        finally { heldMetadata.done.resolve(); }
      } else await json({ source: "Cinemeta", movie: { ...movie, description: "Current second-title metadata" } });
      return true;
    }
    return false;
  };
  const run = await begin(browser, viewport, "mocked-edges", mockRoute);
  const { context, page, result, screenshot } = run;
  try {
    const wall = await run.open();
    const options = await wall.locator("#collection-picker option").evaluateAll((entries) => entries.map((entry) => ({ value: entry.value, label: entry.textContent })));
    assert.equal(new Set(options.map((entry) => entry.value)).size, options.length, "Duplicate private/curated collection IDs must collapse");
    assert.equal(options.filter((entry) => entry.value === "shared-saved").length, 1);
    assert.match(options.find((entry) => entry.value === "nuvio-library").label, /\b2\s+titles\b/);
    result.checks.push("Duplicate saved collection IDs collapse while imported collection counts remain visible");

    const first = await catalogue(page, wall, () => wall.locator("#collection-picker").selectOption("browse-movie"),
      { type: "movie", catalog: "top", skip: 0 });
    assert.equal(first.movies.length, 0);
    assert.equal(await wall.locator("#load-more").isVisible(), true, "An empty page with a continuation must not strand the list");
    await catalogue(page, wall, () => wall.locator("#load-more").click(), { type: "movie", catalog: "top", skip: 50 });
    assert.deepEqual((await wall.locator(".movie-title").allTextContents()).sort(), [data.a.title, data.b.title].sort());
    await catalogue(page, wall, () => wall.locator("#load-more").click(), { type: "movie", catalog: "top", skip: 100 });
    assert.equal(await wall.locator(".movie-tile").count(), 3, "Repeated page records must not duplicate tiles");
    assert.equal(await wall.locator("#load-more").isVisible(), false, "Provider end-of-list must stop pagination");
    assert.deepEqual(result.browseRequests.slice(0, 3).map((request) => request.skip), [0, 50, 100]);
    result.checks.push("Empty first page continues at 50, duplicate rows collapse, and next_skip reaches 100 independently of displayed counts");

    // Metadata belongs to a particular open title. A delayed first response
    // must not overwrite a second title after the first dialog was closed.
    await wall.locator(".movie-tile").filter({ hasText: data.a.title }).locator(".movie-card").click();
    await bounded(heldMetadata.seen.promise, "First title never requested full metadata");
    await wall.locator("#close-dialog").click();
    await wall.locator(".movie-tile").filter({ hasText: data.b.title }).locator(".movie-card").click();
    await wall.waitForFunction(() => document.getElementById("dialog-description").textContent === "Current second-title metadata");
    heldMetadata.release.resolve();
    await bounded(heldMetadata.done.promise, "Held metadata route did not finish");
    await framesSettled(wall);
    assert.equal(await wall.locator("#dialog-title").textContent(), data.b.title);
    assert.equal(await wall.locator("#dialog-description").textContent(), "Current second-title metadata");
    await wall.locator("#close-dialog").click();
    result.checks.push("A stale metadata response cannot overwrite a newly opened title");

    await wall.locator("#catalog-source").selectOption("imdbRating");
    await bounded(heldBrowse.seen.promise, "Featured query was not issued");
    await catalogue(page, wall, () => wall.locator("#catalog-source").selectOption("year"),
      { type: "movie", catalog: "year", skip: 0 });
    heldBrowse.release.resolve();
    await bounded(heldBrowse.done.promise, "Held featured route did not finish");
    await framesSettled(wall);
    assert.equal(await wall.locator("#catalog-source").inputValue(), "year");
    assert.deepEqual(await wall.locator(".movie-title").allTextContents(), [data.current.title]);
    result.checks.push("Changing catalogue during an in-flight request keeps the latest query and ignores the stale response");

    await catalogue(page, wall, () => wall.locator("#catalog-year").selectOption("1990"),
      { type: "movie", catalog: "year", genre: "1990", skip: 0 });
    await wall.locator("#open-filters").click();
    await wall.locator("#saved-view-name").fill("Fixture year view");
    await wall.locator("#save-view").click();
    await wall.locator("#apply-filters").click();
    await catalogue(page, wall, () => wall.locator("#catalog-source").selectOption("top"),
      { type: "movie", catalog: "top", genre: "", skip: 0, search: "" });
    await wall.locator("#open-filters").click();
    await catalogue(page, wall, () => wall.locator("#saved-views").selectOption({ label: "Fixture year view" }),
      { type: "movie", catalog: "year", genre: "1990", skip: 0 });
    await wall.locator("#apply-filters").click();
    assert.equal(await wall.locator("#catalog-source").inputValue(), "year");
    assert.equal(await wall.locator("#catalog-year").inputValue(), "1990");

    const fixtureQuery = "Fixture search query";
    await wall.locator("#catalog-search").fill(fixtureQuery);
    await catalogue(page, wall, () => wall.locator("#catalog-search-button").click(),
      { type: "movie", catalog: "top", genre: "", skip: 0, search: fixtureQuery });
    await wall.locator("#open-filters").click();
    await wall.locator("#saved-view-name").fill("Fixture search view");
    await wall.locator("#save-view").click();
    await wall.locator("#apply-filters").click();
    await catalogue(page, wall, () => wall.locator("#catalog-source").selectOption("year"),
      { type: "movie", catalog: "year", skip: 0, search: "" });
    await wall.locator("#open-filters").click();
    await catalogue(page, wall, () => wall.locator("#saved-views").selectOption({ label: "Fixture search view" }),
      { type: "movie", catalog: "top", genre: "", skip: 0, search: fixtureQuery });
    await wall.locator("#apply-filters").click();
    assert.equal(await wall.locator("#catalog-search").inputValue(), fixtureQuery);
    assert.equal(await wall.locator("#catalog-source").inputValue(), "top");
    assert.equal(await wall.locator("#catalog-genre").inputValue(), "");
    result.checks.push("Saved views restore provider catalogue/year and catalogue search in isolated browser storage");
    await screenshot("restored-search");
    run.assertNoWrites();
    result.pass = true;
  } catch (error) {
    result.error = error.message;
    try { await screenshot("failure"); } catch { /* Keep original failure. */ }
  } finally {
    heldBrowse.release.resolve();
    heldMetadata.release.resolve();
    await context.close();
  }
  return result;
}

(async () => {
  fs.mkdirSync(output, { recursive: true, mode: 0o700 });
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.MOVIE_NIGHT_CHROME || "/usr/bin/google-chrome", args: ["--no-sandbox"] });
  const results = [];
  try {
    for (const viewport of viewports) results.push(await livePass(browser, viewport));
    for (const viewport of viewports) results.push(await edgePass(browser, viewport));
  } finally { await browser.close(); }
  const report = { schema: "movie-night.expanded-browse-verification/v1", verified_at: new Date().toISOString(),
    pass: results.every((result) => result.pass), baseUrl: base.origin,
    policy: "Fresh contexts; native bridge disabled; live catalogue/library GETs in live passes; deliberately mocked edge fixtures in separate passes; all player reads and settings defaults mocked; all writes blocked before navigation.",
    livePlayerRequests: 0, mediaStarted: 0, results };
  const target = path.join(output, "report.json");
  fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ pass: report.pass, results: results.map(({ mode, viewport, pass, error }) =>
    ({ mode, viewport: viewport.name, pass, error })), report: target, livePlayerRequests: 0 }, null, 2));
  if (!report.pass) process.exitCode = 1;
})().catch((error) => { console.error(error.message); process.exitCode = 1; });

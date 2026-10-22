"use strict";
// All player requests are intercepted before load. No real media can start.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.MOVIE_NIGHT_PLAYWRIGHT || '/media/chrishallberg/Storage 22/999_Work/003_Projects/017_xi-io_inbox/node_modules/playwright');
const base = new URL(process.env.MOVIE_NIGHT_URL || 'http://127.0.0.1:8789');
assert.ok(['127.0.0.1', 'localhost'].includes(base.hostname));
const output = path.resolve(process.argv[2] || path.join(__dirname, 'title-experience-results'));
fs.mkdirSync(output, { recursive: true });
const ID = 'tt0088763';
const source1080 = 'fixture1080_____________________';
const source4k = 'fixture2160_____________________';
const pause = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.MOVIE_NIGHT_CHROME || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const results = [];
  try {
    for (const viewport of [{ name: 'desktop', width: 1280, height: 900 }, { name: 'tablet', width: 768, height: 1024 }, { name: 'phone', width: 430, height: 900 }]) {
      const context = await browser.newContext({ viewport, reducedMotion: 'reduce', serviceWorkers: 'block' });
      const page = await context.newPage(); page.setDefaultTimeout(15000);
      const result = { viewport: viewport.name, pass: false, checks: [], requests: [], pageErrors: [], livePlayerRequests: 0 };
      let current = { state: 'idle', title: '', imdb_id: '', volume: 65, duration: 0, position: 0 };
      let sourceMode = 'normal'; let sourceDelay = 0;
      page.on('pageerror', e => result.pageErrors.push(e.message));
      await context.route('**/api/player/**', async route => {
        const request = route.request(); const endpoint = new URL(request.url()).pathname;
        const body = request.method() === 'POST' ? request.postDataJSON() : null;
        result.requests.push({ endpoint, body });
        const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
        if (endpoint.endsWith('/status')) return reply(current);
        if (endpoint.endsWith('/sources')) {
          await pause(sourceDelay);
          if (sourceMode === 'error') return reply({ code: 'provider_unavailable', error: 'Unavailable' }, 503);
          return reply({ imdb_id: body.imdb_id, sources: sourceMode === 'empty' ? [] : [
            { id: source1080, label: '1080p · RD cached · Source 1', quality: '1080p', video_codec: 'HEVC / H.265', audio: ['DD+', '5.1'], size_bytes: 2147483648 },
            { id: source4k, label: '2160p · RD cached · Source 2', quality: '2160p', video_codec: 'HEVC / H.265', dynamic_range: 'Dolby Vision', audio: ['Dolby Atmos', '7.1'], size_bytes: 21474836480 }
          ] });
        }
        if (endpoint.endsWith('/play')) {
          assert.equal(body.imdb_id, ID); assert.ok([source1080, source4k].includes(body.source_id));
          if (sourceMode === 'expired') return reply({ code: 'source_expired', error: 'Expired' }, 409);
          current = { ...current, state: 'playing', imdb_id: body.imdb_id, title: body.title, duration: 6800 };
          return reply(current, 202);
        }
        if (endpoint.endsWith('/command')) {
          if (body.command === 'resume') current.state = 'playing';
          else if (body.command === 'stop') current = { ...current, state: 'idle', imdb_id: '', title: '', duration: 0 };
          else throw new Error('Unexpected player command in title test');
          return reply(current);
        }
        throw new Error('Unexpected player route');
      });
      // Private user mutations are blocked; this test exercises navigation only.
      await context.route('**/api/personal-library/**', route => route.request().method() === 'POST'
        ? route.fulfill({ status: 403, contentType: 'application/json', body: '{"error":"Test blocks personal writes"}' }) : route.continue());
      try {
        await page.goto(base.href, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.querySelectorAll('.movie-card').length >= 100);
        const card = page.getByRole('button', { name: /^View details: Back to the Future \(1985\)/ });
        await card.scrollIntoViewIfNeeded();
        const scroll = await page.evaluate(() => window.scrollY);
        await card.click();
        await page.locator('#film-dialog').waitFor({ state: 'visible' });
        assert.equal(await page.locator('.page-shell').isVisible(), false);
        assert.equal(await page.locator('#film-dialog').evaluate(e => e.tagName), 'SECTION');
        await page.locator('#detail-facts').getByText('Robert Zemeckis', { exact: true }).waitFor({ timeout: 35000 });
        assert.ok((await page.locator('#detail-facts').innerText()).includes('Michael J. Fox'));
        assert.equal(result.requests.filter(x => !x.endpoint.endsWith('/status')).length, 0);
        await page.screenshot({ path: path.join(output, `${viewport.name}-detail.png`) });
        result.checks.push('Full content detail route displays real enriched metadata without player writes');
        await page.locator('#play-on-aries').click();
        await page.locator('#source-list input').first().waitFor();
        assert.equal(await page.locator('#play-source').isDisabled(), true);
        assert.equal(result.requests.filter(x => x.endpoint.endsWith('/play')).length, 0);
        await page.locator('#source-quality').selectOption('2160p');
        assert.equal(await page.locator('#source-list input').count(), 1);
        await page.locator('#source-list input').check();
        assert.equal(await page.locator('#play-source').isEnabled(), true);
        await page.screenshot({ path: path.join(output, `${viewport.name}-sources.png`) });
        await page.locator('#source-quality').selectOption('1080p');
        assert.equal(await page.locator('#play-source').isDisabled(), true, 'Hidden selection must be cleared');
        await page.locator('#source-list input').check();
        await page.locator('#play-source').click();
        await page.locator('#film-dialog').waitFor({ state: 'hidden' });
        assert.equal(result.requests.filter(x => x.endpoint.endsWith('/play')).length, 1);
        assert.equal(result.requests.find(x => x.endpoint.endsWith('/play')).body.source_id, source1080);
        assert.ok(Math.abs((await page.evaluate(() => scrollY)) - scroll) < 5, 'Back restores wall position');
        result.checks.push('Filtering clears hidden selections; exactly the selected source is submitted once; wall state restored');
        current.state = 'paused';
        await pause(2200);
        await card.click();
        await page.waitForFunction(() => document.getElementById('play-on-aries-label').textContent.includes('Resume'));
        await page.locator('#play-on-aries').click();
        await page.locator('#film-dialog').waitFor({ state: 'hidden' });
        assert.equal(result.requests.filter(x => x.endpoint.endsWith('/play')).length, 1, 'Resume cannot reload source');
        assert.ok(result.requests.some(x => x.body?.command === 'resume'));
        result.checks.push('Resume uses the existing session, not a new source or load');
        current = { ...current, state: 'idle', imdb_id: '', title: '' }; await pause(2200);
        await card.scrollIntoViewIfNeeded();
        const finalOpenScroll = await page.evaluate(() => scrollY);
        await card.click();
        sourceMode = 'empty'; await page.locator('#choose-sources').click();
        await page.waitForFunction(() => document.getElementById('source-status').textContent.includes('No confirmed cached'));
        assert.equal(await page.locator('#play-source').isDisabled(), true);
        sourceMode = 'error'; await page.locator('#refresh-sources').click();
        await page.waitForFunction(() => document.getElementById('source-status').textContent.includes('unavailable'));
        sourceMode = 'expired'; await page.locator('#refresh-sources').click();
        await page.locator('#source-list input').first().waitFor();
        await page.locator('#source-list input').first().check(); await page.locator('#play-source').click();
        await page.waitForFunction(() => document.getElementById('source-status').textContent.includes('expired'));
        assert.equal(await page.locator('#play-source').isDisabled(), true);
        result.checks.push('Empty, provider-error and expired-source cases remain visible and never silently fall back');
        sourceMode = 'normal'; sourceDelay = 300;
        await page.locator('#refresh-sources').click(); await page.locator('#cancel-sources').click(); await pause(500);
        assert.equal(await page.locator('#source-picker').isVisible(), false);
        await page.keyboard.press('Escape');
        await page.locator('#film-dialog').waitFor({ state: 'hidden' });
        assert.ok(Math.abs((await page.evaluate(() => scrollY)) - finalOpenScroll) < 5, 'Escape restores the current opening position, not an older pre-playback layout');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        assert.equal(result.pageErrors.length, 0, result.pageErrors.join('\n'));
        result.checks.push('Closing cancels stale source replies; Escape returns to the unchanged wall; no horizontal overflow');
        result.pass = true;
      } catch (error) {
        result.error = error.stack; await page.screenshot({ path: path.join(output, `${viewport.name}-failure.png`) }).catch(() => {});
      } finally { await context.close(); }
      results.push(result); console.log(JSON.stringify({ viewport: viewport.name, pass: result.pass, checks: result.checks, error: result.error }));
    }
  } finally { await browser.close(); }
  const report = { pass: results.every(r => r.pass), livePlayerRequests: 0, playbackEvidence: 'intercepted synthetic responses, no real film launched', results };
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  process.exitCode = report.pass ? 0 : 1;
})().catch(error => { console.error(error); process.exitCode = 1; });

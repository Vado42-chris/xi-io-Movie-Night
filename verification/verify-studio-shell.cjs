const { chromium } = require('/media/chrishallberg/Storage 22/999_Work/003_Projects/017_xi-io_inbox/node_modules/playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const OUT = '/home/chrishallberg/Documents/Personal-Movies/movie-night-runtime/studio-verification';

(async () => {
  fs.mkdirSync(OUT, { recursive: true, mode: 0o700 });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
  const report = { playbackWrites: 0, cases: [] };
  try {
    for (const viewport of [{width:1280,height:800},{width:768,height:1024}]) {
      const context = await browser.newContext({ viewport });
      const errors = [];
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/player/**', async route => {
        if (route.request().method() !== 'GET') {
          report.playbackWrites++; return route.abort();
        }
        await route.fulfill({ json: { state:'idle', title:'', imdb_id:'', position:0, duration:0, volume:65, muted:false, fullscreen:false } });
      });
      await page.route('**/api/concierge/chat', route => route.abort());
      await page.goto('http://127.0.0.1:8789/studio', {waitUntil:'networkidle'});
      const frame = page.locator('.movie-pane-wrap .xi-window');
      await frame.waitFor({state:'visible',timeout:10000});
      const wall = page.frameLocator('#movie-wall');
      await wall.locator('#film-grid > *').first().waitFor();
      const initial = await frame.boundingBox();
      assert(initial.width >= 400 && initial.height >= 300);
      await page.screenshot({path:`${OUT}/studio-${viewport.width}.png`});

      await frame.locator('button[title="Minimize"]').click();
      await frame.waitFor({state:'hidden'});
      await page.getByRole('button',{name:'Movie Night',exact:true}).click();
      await frame.waitFor({state:'visible'});
      await frame.locator('button[title="Maximize"]').click();
      await frame.locator('button[title="Restore"]').waitFor();
      const maximized = await frame.boundingBox();
      assert(maximized.width >= initial.width);
      await frame.locator('button[title="Restore"]').click();

      // Use the pinned title bar and bottom-right handle, not replacement drag logic.
      const title = frame.locator('[data-xi-probe="identity"]');
      const titleRect = await title.boundingBox();
      await page.mouse.move(titleRect.x+Math.min(260,titleRect.width/2),titleRect.y+22);
      await page.mouse.down(); await page.mouse.move(titleRect.x+Math.min(260,titleRect.width/2)+8,titleRect.y+36,{steps:6}); await page.mouse.up();
      const dragged = await frame.boundingBox();
      assert(Math.abs(dragged.y-initial.y)>2 || Math.abs(dragged.x-initial.x)>2, 'Original frame drag did not move');
      const grip = frame.locator('.cursor-se-resize');
      const g = await grip.boundingBox();
      await page.mouse.move(g.x+g.width/2,g.y+g.height/2); await page.mouse.down();
      await page.mouse.move(g.x+g.width/2-30,g.y+g.height/2-24,{steps:5}); await page.mouse.up();
      const resized = await frame.boundingBox();
      assert(resized.width < dragged.width && resized.height < dragged.height, 'Original frame resize did not resize');

      await page.getByRole('button',{name:'Ask @ibal',exact:true}).click();
      await page.getByRole('heading',{name:'@ibal',exact:true}).waitFor();
      await page.screenshot({path:`${OUT}/studio-chat-${viewport.width}.png`});
      await page.getByRole('button',{name:'Close concierge',exact:true}).click();
      await frame.locator('button[title="Close"]').click();
      await frame.waitFor({state:'hidden'});
      await page.getByRole('button',{name:'Open Movie Night',exact:true}).click();
      await frame.waitFor({state:'visible'});
      assert.equal(errors.length,0,errors.join('\n'));
      report.cases.push({ viewport, outcome:'PASS', pinnedDrag:true, pinnedResize:true, minimizeReopen:true, maximizeRestore:true, closeReopen:true, chat:true, errors });
      await context.close();
    }
    assert.equal(report.playbackWrites,0);
    report.outcome='PASS';
  } catch(error) { report.outcome='FAIL'; report.error=error.message; process.exitCode=1; }
  finally { await browser.close(); fs.writeFileSync(`${OUT}/report.json`,JSON.stringify(report,null,2)); console.log(JSON.stringify(report,null,2)); }
})();

// Probe: home combobox must open DOWNWARD (menu below the pill)
import { chromium } from 'playwright';

const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
pg.on('pageerror', e => errs.push('pageerror: ' + e.message));

await pg.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await pg.waitForTimeout(1200);

const fr = pg.frames().find(f => f !== pg.mainFrame());
if (!fr) { console.log('FAIL: no iframe'); process.exit(1); }

const btn = fr.locator('#homeModelBtn');
const wrap = fr.locator('#homeModelWrap');

// wrap has 'down' class?
console.log('1. wrap classes:', await wrap.getAttribute('class'));

// open menu
await btn.click();
await pg.waitForTimeout(350);

const bb = await btn.boundingBox();
const mb = await fr.locator('#homeModelMenu').boundingBox();
console.log('2. btn bottom:', bb.y + bb.height, '| menu top:', mb.y);
console.log('3. menu opens downward:', mb.y >= bb.y + bb.height, '| items:', await fr.locator('#homeModelMenu .model-item').count());

await pg.screenshot({ path: 'download/preview-10-home-menu-down.png' });

// chat view menu must still open UPWARD (composer at screen bottom)
await pg.keyboard.press('Escape');
await fr.locator('#homeInput').click();
await pg.keyboard.press('Enter');   // send from home -> enters chat view
await pg.waitForTimeout(2500);
const cbtn = fr.locator('#modelBtn');
if (await cbtn.isVisible().catch(() => false)) {
  await cbtn.click();
  await pg.waitForTimeout(300);
  const cb = await cbtn.boundingBox();
  const cm = await fr.locator('#modelMenu').boundingBox();
  console.log('4. chat menu top:', cm.y, '| btn top:', cb.y, '| opens upward:', cm.y < cb.y);
  await pg.keyboard.press('Escape');
  await pg.screenshot({ path: 'download/preview-11-chat-menu-up.png' });
} else {
  console.log('4. chat selector not visible yet (chat may still be loading) — skip');
}

console.log('page errors:', errs.length ? errs : 'none');
console.log('DOWNWARD PROBE DONE');
await b.close();

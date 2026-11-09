// Probe: model selector on home screen + no Discord traces (lean version)
import { chromium } from 'playwright';

const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
pg.on('pageerror', e => errs.push('pageerror: ' + e.message));

await pg.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await pg.waitForTimeout(1200);

const fr = pg.frames().find(f => f !== pg.mainFrame());
if (!fr) { console.log('FAIL: no iframe'); process.exit(1); }

// 1. home view has the model selector, visible
const btn = fr.locator('#homeModelBtn');
const vis = await btn.isVisible().catch(() => false);
const label1 = vis ? (await btn.locator('.ml').textContent()).trim() : '(missing)';
console.log('1. home selector visible:', vis, '| label:', label1);

// 2. no discord text anywhere
const body = await fr.locator('body').innerText();
const disc = (body.match(/discord/gi) || []).length;
console.log('2. "discord" occurrences in rendered UI:', disc);

// 3. open the menu
await btn.click();
await pg.waitForTimeout(300);
const menuItems = await fr.locator('#homeModelMenu .model-item').count();
const mh = await fr.locator('#homeModelMenu .mh').textContent().catch(() => '(none)');
console.log('3. menu open — items:', menuItems, '| header:', mh);

// 4. select glm-5.3 in home menu
await fr.locator('#homeModelMenu .model-item', { hasText: 'glm-5.3' }).first().click();
await pg.waitForTimeout(250);
const model = await fr.evaluate(() => window.__xrModel());
const label2 = (await fr.locator('#homeModelBtn .ml').textContent()).trim();
const chatLabel = await fr.evaluate(() => document.querySelector('#modelBtn .ml')?.textContent?.trim());
console.log('4. selected -> __xrModel:', model, '| home btn:', label2, '| chat btn:', chatLabel);

// screenshot: home with selector + toast visible
await pg.screenshot({ path: 'download/preview-8-home-selector.png' });

// 5. open home menu again for "open menu" screenshot (click outside first closes it)
await fr.locator('#homeInput').click();
await pg.waitForTimeout(200);
await btn.click();
await pg.waitForTimeout(350);
const openCount = await fr.locator('#homeModelMenu .model-item:visible').count();
console.log('5. menu re-opened, visible items:', openCount);
await pg.screenshot({ path: 'download/preview-9-home-menu-open.png' });

// 6. reset back to default model for the user
await fr.locator('#homeModelMenu .model-item', { hasText: 'prime-v1-flash' }).first().click();
await pg.waitForTimeout(200);
console.log('6. reset to:', await fr.evaluate(() => window.__xrModel()));

console.log('page errors:', errs.length ? errs : 'none');
console.log('MODEL-HOME PROBE DONE');
await b.close();

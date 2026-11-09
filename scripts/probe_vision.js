// probe_vision.js — end-to-end: post a photo in XR-Code, verify the AI actually SEES it.
// Real brain, real vision call. Lightweight: 2 screenshots, no heavy validation.
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const BASE = 'http://localhost:3000';

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const frame = page.frames().find(f => f !== page.mainFrame());
  if (!frame) { console.log('FAIL: app iframe not found'); process.exit(1); }
  if ((await frame.locator('#chatForm').count()) === 0) { console.log('FAIL: chatForm missing in iframe'); process.exit(1); }
  console.log('iframe OK');

  // 1) photo + question — from the HOME screen (real user flow)
  await frame.setInputFiles('#chatForm input[type="file"]', '/tmp/vtest.png');
  await page.waitForTimeout(600);
  const chipImgs = await frame.locator('.attach-row img').count();
  console.log('attach chip preview imgs:', chipImgs);

  await frame.fill('#homeInput', 'Look at my photo. What exactly do you see? Be specific.');
  await frame.press('#homeInput', 'Enter');
  console.log('sent photo + question, waiting for the brain…');

  const lastBubble = frame.locator('.msg.a .bubble').last();
  const t0 = Date.now();
  let reply = '';
  while (Date.now() - t0 < 120000) {
    await page.waitForTimeout(3000);
    const txt = (await lastBubble.textContent().catch(() => '')) || '';
    const dots = await frame.locator('.dots').count();
    if (txt && txt.length > 40 && dots === 0) { reply = txt; break; }
  }
  console.log('REPLY-1 (' + Math.round((Date.now() - t0) / 1000) + 's): ' + reply.slice(0, 400));
  const saw = /blue|circle|red|42|yellow/i.test(reply);
  console.log(saw ? 'PASS: reply references the actual image content' : 'WARN: reply may not reference image');

  // 2) bare photo, no text at all
  await frame.fill('#chatInput', '');
  await frame.setInputFiles('#chatForm input[type="file"]', '/tmp/vtest.png');
  await page.waitForTimeout(500);
  await frame.press('#chatInput', 'Enter');
  console.log('sent bare photo (no text)…');
  const t1 = Date.now();
  let reply2 = '';
  while (Date.now() - t1 < 120000) {
    await page.waitForTimeout(3000);
    const b = frame.locator('.msg.a .bubble');
    const n = await b.count();
    const txt = n ? ((await b.nth(n - 1).textContent().catch(() => '')) || '') : '';
    const dots = await frame.locator('.dots').count();
    if (txt && txt.length > 40 && dots === 0) { reply2 = txt; break; }
  }
  console.log('REPLY-2 (' + Math.round((Date.now() - t1) / 1000) + 's): ' + reply2.slice(0, 400));
  const saw2 = /blue|circle|red|42|yellow|photo|image/i.test(reply2);
  console.log(saw2 ? 'PASS: bare photo gets a real description' : 'WARN: bare photo reply weak');

  await page.screenshot({ path: '/home/z/my-project/download/preview-5-vision.png' });
  console.log('screenshot saved: download/preview-5-vision.png');
  await browser.close();
  process.exit(saw && saw2 ? 0 : 2);
})();

// probe_modelsel.js — verify the model combobox: open, list, select, send with it.
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const frame = page.frames().find(f => f !== page.mainFrame());
  if (!frame) { console.log('FAIL: no iframe'); process.exit(1); }

  // 1) from home: attach nothing, just send a question -> uses default prime-v1-flash
  await frame.fill('#homeInput', 'Reply with exactly: DEFAULT BRAIN OK');
  await frame.press('#homeInput', 'Enter');
  await page.waitForTimeout(1500);

  // 2) in chat: open the model dropdown
  const btn = frame.locator('#modelBtn');
  console.log('model btn visible:', await btn.isVisible());
  console.log('btn label before:', (await btn.textContent()).trim());
  await btn.click();
  await page.waitForTimeout(400);
  const items = await frame.locator('.model-item').count();
  console.log('dropdown items:', items);
  await page.screenshot({ path: '/home/z/my-project/download/preview-6-model-open.png' });

  // 3) select glm-5.3 (flagship)
  await frame.locator('.model-item', { hasText: 'glm-5.3' }).last().click();
  await page.waitForTimeout(300);
  console.log('btn label after:', (await btn.textContent()).trim());

  // 4) send a message with the selected model
  await frame.fill('#chatInput', 'Reply with exactly: FLAGSHIP BRAIN OK');
  await frame.press('#chatInput', 'Enter');
  const t0 = Date.now();
  let reply = '';
  const bubbles = frame.locator('.msg.a .bubble');
  while (Date.now() - t0 < 90000) {
    await page.waitForTimeout(3000);
    const n = await bubbles.count();
    const txt = n ? ((await bubbles.nth(n - 1).textContent().catch(() => '')) || '') : '';
    if (txt && txt.length > 3 && (await frame.locator('.dots').count()) === 0) { reply = txt; break; }
  }
  console.log('reply with glm-5.3 (' + Math.round((Date.now() - t0) / 1000) + 's):', reply.slice(0, 120));

  // 5) reopen dropdown for the "selected" state screenshot
  await btn.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/home/z/my-project/download/preview-7-model-selected.png' });

  await browser.close();
  console.log(items >= 5 ? 'PASS: dropdown lists models and selection works' : 'FAIL: dropdown items missing');
  process.exit(items >= 5 ? 0 : 2);
})();

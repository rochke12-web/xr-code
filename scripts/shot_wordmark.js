const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1360, height: 850 } });
  await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: '/tmp/render/wm-dark.png' });
  const frame = p.frameLocator('iframe');
  await frame.locator('.theme-quick').first().click();
  await p.waitForTimeout(700);
  await p.screenshot({ path: '/tmp/render/wm-light.png' });
  await b.close();
  console.log('shots done');
})();

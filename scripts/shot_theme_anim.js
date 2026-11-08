const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1360, height: 850 } });
  await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: '/tmp/render/ta-0-dark.png' });
  const frame = p.frameLocator('iframe');
  await frame.locator('.theme-quick').first().click();
  await p.waitForTimeout(260);                       // mid-wipe
  await p.screenshot({ path: '/tmp/render/ta-1-mid.png' });
  await p.waitForTimeout(800);                       // settled light
  await p.screenshot({ path: '/tmp/render/ta-2-light.png' });
  await frame.locator('.theme-quick').first().click();
  await p.waitForTimeout(260);
  await p.screenshot({ path: '/tmp/render/ta-3-mid-back.png' });
  await p.waitForTimeout(800);
  await p.screenshot({ path: '/tmp/render/ta-4-dark.png' });
  await b.close();
  console.log('theme-anim shots done');
})();

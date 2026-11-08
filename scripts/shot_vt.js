const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1360, height: 850 } });
  await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: '/tmp/render/ta-dark.png' });
  const fr = p.frames().find(f => f !== p.mainFrame());
  await fr.evaluate(() => document.getElementById('themeQuick').click()); // no actionability delay
  await p.screenshot({ path: '/tmp/render/ta-wipe-1.png' });              // fires ~mid-wipe
  await p.screenshot({ path: '/tmp/render/ta-wipe-2.png' });              // slightly later
  await p.waitForTimeout(900);
  await p.screenshot({ path: '/tmp/render/ta-light.png' });
  await b.close();
  console.log('wipe shots done');
})();

const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1360, height: 850 } });
  await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  const fr = p.frames().find(f => f !== p.mainFrame());
  // dark -> light: expect light expanding from TOP RIGHT
  await fr.evaluate(() => document.getElementById('themeQuick').click());
  await p.screenshot({ path: '/tmp/render/dl-1.png' });
  await p.screenshot({ path: '/tmp/render/dl-2.png' });
  await p.screenshot({ path: '/tmp/render/dl-3.png' });
  await p.waitForTimeout(900);
  // light -> dark: expect dark expanding from BOTTOM LEFT
  await fr.evaluate(() => document.getElementById('themeQuick').click());
  await p.screenshot({ path: '/tmp/render/dd-1.png' });
  await p.screenshot({ path: '/tmp/render/dd-2.png' });
  await p.screenshot({ path: '/tmp/render/dd-3.png' });
  await b.close();
  console.log('directional shots v2 done');
})();

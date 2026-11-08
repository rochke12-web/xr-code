const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1360, height: 850 } });
  await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  const fr = p.frames().find(f => f !== p.mainFrame());
  // dark -> light: wipe must start top right
  await fr.evaluate(() => document.getElementById('themeQuick').click());
  await p.screenshot({ path: '/tmp/render/dir-to-light.png' });
  await p.waitForTimeout(900);
  // light -> dark: wipe must start bottom left
  await fr.evaluate(() => document.getElementById('themeQuick').click());
  await p.screenshot({ path: '/tmp/render/dir-to-dark.png' });
  await b.close();
  console.log('directional shots done');
})();

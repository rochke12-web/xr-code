const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1360, height: 850 } });
  await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  const clip = { x: 1040, y: 480, width: 160, height: 90 };  // send button area
  await p.screenshot({ path: '/tmp/render/chev-rest.png', clip });          // normal: >
  const fr = p.frames().find(f => f !== p.mainFrame());
  await fr.evaluate(() => document.querySelector('#homeForm .send-btn').click());
  await p.waitForTimeout(140);                               // mid/most of the 280ms rotate
  await p.screenshot({ path: '/tmp/render/chev-flip.png', clip });          // flipped: <
  await p.waitForTimeout(900);                               // reverted + maybe navigated
  await p.screenshot({ path: '/tmp/render/chev-after.png' });
  await b.close();
  console.log('chevron shots done');
})();

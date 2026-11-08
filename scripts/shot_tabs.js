const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);
  const fr = p.frames().find(f => f !== p.mainFrame());
  const box = await fr.evaluate(() => {
    const r = document.querySelector('.sidebar').getBoundingClientRect();
    return { x: Math.max(0, r.left - 14), y: 0, w: r.width + 28, h: 420 };
  });
  const clip = { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.w), height: Math.round(box.h) };

  await p.screenshot({ path: '/tmp/render/sb-home.png', clip });                        // pill on Home
  await fr.evaluate(() => document.getElementById('btnSettings').click());
  await p.waitForTimeout(140);
  await p.screenshot({ path: '/tmp/render/sb-mid.png', clip });                         // pill mid-glide
  await p.waitForTimeout(600);
  await p.screenshot({ path: '/tmp/render/sb-settings.png', clip });                    // pill on Settings
  await fr.evaluate(() => document.getElementById('btnHome').click());
  await p.waitForTimeout(700);
  await p.screenshot({ path: '/tmp/render/sb-back.png', clip });                        // pill back on Home
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

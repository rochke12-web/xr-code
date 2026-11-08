const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1360, height: 850 } });
  await p.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  // poll until iframe app is hydrated, then immediately read running animations
  const out = await p.waitForFunction(() => {
    const f = document.querySelector('iframe');
    if (!f || !f.contentDocument) return null;
    const d = f.contentDocument;
    if (!d.querySelector('.scene') || !d.querySelector('.scene').src) return null; // hydrated?
    const names = new Set();
    d.getAnimations().forEach(a => {
      const n = a.animationName || (a.effect && a.effect.getKeyframes && '') || '';
      if (a.animationName) names.add(a.animationName);
    });
    return { running: [...names], count: d.getAnimations().length };
  }, { timeout: 15000, polling: 50 }).then(h => h.jsonValue());
  console.log(JSON.stringify(out));
  await p.waitForTimeout(1500);
  const fr = p.frames().find(f => f !== p.mainFrame());
  await fr.evaluate(() => document.getElementById('themeQuick').click());
  await p.waitForTimeout(900);
  await p.screenshot({ path: '/tmp/render/ui-home-light.png' });
  await b.close();
  console.log('entrance probe done');
})();

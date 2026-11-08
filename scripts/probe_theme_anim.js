const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1360, height: 850 } });
  await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1000);
  const fr = p.frames().find(f => f !== p.mainFrame());
  if (!fr) throw new Error('iframe not found');

  // functional probe: does startViewTransition exist, and does the wipe animation run?
  const probe = await fr.evaluate(async () => {
    const support = typeof document.startViewTransition;
    document.getElementById('themeQuick').click();       // instant DOM click
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const anims = document.getAnimations().map(a => ({
      pseudo: a.effect && a.effect.pseudoElement || null,
      dur: a.effect && a.effect.getTiming().duration || null,
      prop: a.effect && a.effect.getKeyframes ? (a.effect.getKeyframes()[1] || {}).clipPath !== undefined : false
    }));
    const vt = document.documentElement.querySelectorAll(':scope').length; // noop keepalive
    return { support, anims, theme: document.documentElement.dataset.theme };
  });
  console.log(JSON.stringify(probe, null, 1));

  // clipped fast capture ~100ms into the wipe (toggle back to dark first? no - state is light now, wipe to dark)
  const probe2 = await fr.evaluate(() => {
    document.getElementById('themeQuick').click();
    return document.documentElement.dataset.theme;       // theme already flipped synchronously
  });
  await p.screenshot({ path: '/tmp/render/ta-mid2.png', clip: { x: 300, y: 0, width: 1060, height: 850 } });
  await p.waitForTimeout(900);
  await p.screenshot({ path: '/tmp/render/ta-settled.png' });
  await b.close();
  console.log('probe done, flipped to:', probe2);
})();

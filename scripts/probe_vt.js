const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  // default context (browser defaults) then forced no-preference
  for (const rm of [null, 'no-preference']) {
    const ctx = await b.newContext(rm ? { reducedMotion: rm } : {});
    const p = await ctx.newPage();
    await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await p.waitForTimeout(800);
    const fr = p.frames().find(f => f !== p.mainFrame());
    const out = await fr.evaluate(async () => {
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const support = typeof document.startViewTransition;
      document.getElementById('themeQuick').click();
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const anims = document.getAnimations()
        .filter(a => a.effect && a.effect.pseudoElement)
        .map(a => ({
          pseudo: a.effect.pseudoElement,
          dur: a.effect.getTiming().duration,
          clip: (a.effect.getKeyframes().find(k => k.clipPath) || {}).clipPath || null
        }));
      return { reduce, support, vtAnims: anims, total: document.getAnimations().length };
    });
    console.log(rm ? '[forced no-preference]' : '[browser default]', JSON.stringify(out));
    await ctx.close();
  }
  await b.close();
})();

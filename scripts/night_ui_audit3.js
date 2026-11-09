const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const checks = [
    { name: 'iPhone 14 Pro', vw: 393, vh: 852, isMobile: true, hasTouch: true, dpr: 3 },
    { name: 'Android Pixel', vw: 412, vh: 915, isMobile: true, hasTouch: true, dpr: 2.6 },
    { name: 'PC wide', vw: 1440, vh: 900, isMobile: false, hasTouch: false, dpr: 1 },
  ];
  for (const c of checks) {
    const ctx = await browser.newContext({ viewport: { width: c.vw, height: c.vh }, isMobile: c.isMobile, hasTouch: c.hasTouch, deviceScaleFactor: c.dpr });
    const pg = await ctx.newPage();
    await pg.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
    await pg.waitForTimeout(1000);
    const r = await pg.evaluate(() => {
      const frame = document.querySelector('iframe');
      const doc = frame ? frame.contentDocument : document;
      if (!doc) return { err: 'no frame doc' };
      const de = doc.documentElement;
      const input = doc.querySelector('textarea, input[type="text"], [contenteditable="true"]');
      const btns = [...doc.querySelectorAll('button, [role="button"]')].slice(0, 40);
      const smallBtn = btns.length ? Math.min(...btns.map(b => Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height))) : null;
      return {
        hOverflow: de.scrollWidth - de.clientWidth,
        inputTag: input ? input.tagName : null,
        inputFont: input ? parseFloat(getComputedStyle(input).fontSize) : null,
        btnCount: btns.length,
        smallestBtn: smallBtn ? Math.round(smallBtn) : null,
        bodyScrollable: de.scrollHeight > de.clientHeight,
      };
    });
    console.log(`${c.name}: ` + JSON.stringify(r));
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });

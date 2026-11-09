const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);
  const fr = p.frames().find(f => f !== p.mainFrame());
  const st = await fr.evaluate(() => {
    // synthetic F12 keydown to test the guard's preventDefault
    let blocked = false;
    const ev = new KeyboardEvent('keydown', { key: 'F12', bubbles: true, cancelable: true });
    blocked = !document.dispatchEvent(ev);
    const ev2 = new KeyboardEvent('keydown', { key: 'u', ctrlKey: true, bubbles: true, cancelable: true });
    const blocked2 = !document.dispatchEvent(ev2);
    return {
      brand: document.getElementById('brandTitle').textContent,
      hero: document.querySelector('.hero h2').textContent,
      guardOn: !!window.__xrGuard,
      f12Blocked: blocked,
      ctrlUBlocked: blocked2,
      appAlive: !!document.getElementById('homeInput'),
    };
  });
  console.log(JSON.stringify(st));
  await p.screenshot({ path: '/home/z/my-project/download/preview-4-xrcode.png', fullPage: false });
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

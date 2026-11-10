const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const p = await b.newPage({ viewport: { width: 1360, height: 850 } });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

  // entrance mid-flight + settled (dark)
  await p.goto('http://localhost:3000', { waitUntil: 'commit' });
  await p.waitForTimeout(500);
  await p.screenshot({ path: '/tmp/render/bw-entrance.png' });
  await p.waitForTimeout(1500);
  // hide the dev-env gate so the home view is visible
  await p.evaluate(() => { const f = document.querySelector('iframe'); const w = f && f.contentWindow; if (w && w.dsHideLock) w.dsHideLock(); });
  const fr0 = p.frames().find(f => f !== p.mainFrame());
  await fr0.evaluate(() => { if (window.dsHideLock) window.dsHideLock(); });
  await p.waitForTimeout(400);
  await p.screenshot({ path: '/tmp/render/bw-home-dark.png' });
  const fr = p.frames().find(f => f !== p.mainFrame()) || p.mainFrame();

  // chat view (empty state)
  await fr.evaluate(() => showView('chat'));
  await p.waitForTimeout(700);
  await p.screenshot({ path: '/tmp/render/bw-chat-dark.png' });

  // settings
  await fr.evaluate(() => showView('settings'));
  await p.waitForTimeout(700);
  await p.screenshot({ path: '/tmp/render/bw-settings-dark.png' });

  // home light theme
  await fr.evaluate(() => showView('home'));
  await p.waitForTimeout(300);
  await fr.evaluate(() => document.getElementById('themeQuick').click());
  await p.waitForTimeout(1000);
  await p.screenshot({ path: '/tmp/render/bw-home-light.png' });

  // chat light
  await fr.evaluate(() => showView('chat'));
  await p.waitForTimeout(600);
  await p.screenshot({ path: '/tmp/render/bw-chat-light.png' });

  // gate lock (simulate roleconf error)
  await fr.evaluate(() => window.dsShowLock('roleconf'));
  await p.waitForTimeout(700);
  await p.screenshot({ path: '/tmp/render/bw-gate.png' });
  await fr.evaluate(() => window.dsHideLock());

  // mobile dark
  const m = await b.newPage({ viewport: { width: 390, height: 800 } });
  m.on('pageerror', e => errs.push('m pageerror: ' + e.message));
  await m.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await m.waitForTimeout(1400);
  await m.screenshot({ path: '/tmp/render/bw-mobile-dark.png' });
  const mf = m.frames().find(f => f !== m.mainFrame()) || m.mainFrame();
  await mf.evaluate(() => showView('chat'));
  await m.waitForTimeout(600);
  await m.screenshot({ path: '/tmp/render/bw-mobile-chat.png' });

  await b.close();
  console.log('sweep done');
  errs.slice(0, 8).forEach(e => console.log('ERR', e));
  if (!errs.length) console.log('no js errors');
})();

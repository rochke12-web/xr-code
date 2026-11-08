const { chromium } = require('playwright');
(async () => {
  fs = require('fs'); fs.mkdirSync('/tmp/render', { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2200);
  const fr = p.frames().find(f => f !== p.mainFrame());

  let live = false;                                  // brain "down" at first
  let calls = 0;
  await p.route('**/api/chat', async route => {
    calls++;
    if (!live) return route.abort();
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, text: 'Back online — retry worked.' }) });
  });

  await fr.evaluate(() => document.getElementById('btnProject').click());
  await p.waitForTimeout(500);
  await fr.evaluate(() => { document.getElementById('chatInput').value = 'hello brain'; });
  await fr.evaluate(() => document.getElementById('chatForm').dispatchEvent(new Event('submit', { cancelable: true })));

  // wait past the quiet auto-retry (4s) — both attempts fail -> error bubble + Try again
  await p.waitForTimeout(7000);
  const st1 = await fr.evaluate(() => ({
    btn: document.querySelectorAll('#msgs .retry-btn').length,
    err: (Array.from(document.querySelectorAll('#msgs .msg.a .bubble')).pop() || {}).textContent || '',
    chip: document.getElementById('chatModelChip').textContent,
  }));
  console.log('after failure  :', JSON.stringify(st1), '| api calls:', calls);
  await p.screenshot({ path: '/tmp/render/retry-error.png', clip: { x: 300, y: 60, width: 1140, height: 500 } });

  // brain back up -> click Try again
  live = true;
  await fr.evaluate(() => document.querySelector('#msgs .retry-btn').click());
  await p.waitForTimeout(6000);
  const st2 = await fr.evaluate(() => ({
    btn: document.querySelectorAll('#msgs .retry-btn').length,
    last: (Array.from(document.querySelectorAll('#msgs .msg.a .bubble')).pop() || {}).textContent || '',
    chip: document.getElementById('chatModelChip').textContent,
  }));
  console.log('after retry    :', JSON.stringify(st2), '| api calls:', calls);
  await p.screenshot({ path: '/tmp/render/retry-fixed.png', clip: { x: 300, y: 60, width: 1140, height: 500 } });

  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2200);
  const fr = p.frames().find(f => f !== p.mainFrame());

  // Variant A: connection drop (abort) -> expect 2 client calls then error bubble
  // Variant B: upstream 429 (json ok:false) -> expect 1 client call then error bubble
  const variant = process.argv[2] || 'A';
  let calls = 0;
  await p.route('**/api/chat', async route => {
    calls++;
    if (variant === 'A') return route.abort();
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'API request failed with status 429: Too many requests' }) });
  });

  await fr.evaluate(() => document.getElementById('btnProject').click());
  await p.waitForTimeout(400);
  await fr.evaluate(v => { document.getElementById('chatInput').value = 'ping ' + v; }, variant);
  await fr.evaluate(() => document.getElementById('chatForm').dispatchEvent(new Event('submit', { cancelable: true })));
  await p.waitForTimeout(6500);
  const st = await fr.evaluate(() => ({
    btn: document.querySelectorAll('#msgs .retry-btn').length,
    err: (Array.from(document.querySelectorAll('#msgs .msg.a .bubble')).pop() || {}).textContent || '',
  }));
  console.log(`variant ${variant} :`, JSON.stringify(st), '| client calls:', calls, '(expect ' + (variant === 'A' ? 2 : 1) + ')');
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

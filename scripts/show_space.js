const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  fs.mkdirSync('/tmp/render', { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2200);
  const fr = p.frames().find(f => f !== p.mainFrame());

  // --- 1. top bar brand ---
  const tb = await fr.evaluate(() => {
    const r = document.querySelector('.topbar').getBoundingClientRect();
    return { x: 0, y: 0, width: 1440, height: Math.ceil(r.height) + 4 };
  });
  await p.screenshot({ path: '/tmp/render/space-topbar.png', clip: tb });

  // --- 2. hero + mode menu open ---
  await fr.evaluate(() => document.getElementById('modeBtn').click());
  await p.waitForTimeout(500);
  await p.screenshot({ path: '/tmp/render/space-hero.png', fullPage: false });

  // --- 3. chat: mocked coder reply -> who label + chip + fold arrow ---
  await p.route('**/api/chat', async route => {
    const code = ['function add(a, b) {', '  return a + b;', '}', '', 'console.log(add(2, 3));'].join('\n');
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, text: 'Here you go:\n```js\n' + code + '\n```' }) });
  });
  await fr.evaluate(() => document.querySelector('.mode-opt[data-mode="coder"]').click());
  await p.waitForTimeout(300);
  await fr.evaluate(() => document.getElementById('btnProject').click());
  await p.waitForTimeout(500);
  await fr.evaluate(() => { document.getElementById('chatInput').value = 'write an add function'; });
  await fr.evaluate(() => document.getElementById('chatForm').dispatchEvent(new Event('submit', { cancelable: true })));
  await p.waitForTimeout(3000);
  const st = await fr.evaluate(() => ({
    brand: document.getElementById('brandTitle').textContent,
    who: (document.querySelector('#msgs .msg.a .who') || {}).textContent || null,
    chip: document.getElementById('chatModelChip').textContent,
    folds: document.querySelectorAll('#msgs .code-fold').length,
    old: document.body.innerHTML.includes('XR CODE'),
  }));
  console.log(JSON.stringify(st));
  await p.screenshot({ path: '/tmp/render/space-chat.png', fullPage: false });
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

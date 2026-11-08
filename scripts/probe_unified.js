const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  fs.mkdirSync('/tmp/render', { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  let captured = null;
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2200);
  const fr = p.frames().find(f => f !== p.mainFrame());

  // --- 1. hero: mode picker must be gone ---
  await p.route('**/api/chat', async route => {
    captured = route.request().postDataJSON();
    const code = ['function add(a, b) {', '  return a + b;', '}', '', 'console.log(add(2, 3));'].join('\n');
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, text: 'Here you go:\n```js\n' + code + '\n```' }) });
  });
  const hero = await fr.evaluate(() => ({
    modeBtn: !!document.getElementById('modeBtn'),
    modeRow: !!document.getElementById('modeRow'),
    modeOpts: document.querySelectorAll('.mode-opt').length,
    sub: document.querySelector('.hero .sub').textContent,
    chip: document.getElementById('chatModelChip').textContent,
  }));
  console.log('HERO:', JSON.stringify(hero));
  await p.screenshot({ path: '/tmp/render/unified-hero.png', fullPage: false });

  // --- 2. plain type -> code answer (mocked), body must carry NO mode ---
  await fr.evaluate(() => document.getElementById('btnProject').click());
  await p.waitForTimeout(500);
  await fr.evaluate(() => { document.getElementById('chatInput').value = 'write an add function'; });
  await fr.evaluate(() => document.getElementById('chatForm').dispatchEvent(new Event('submit', { cancelable: true })));
  await p.waitForTimeout(3000);
  const code = await fr.evaluate(() => ({
    wraps: document.querySelectorAll('#msgs .code-wrap').length,
    folds: document.querySelectorAll('#msgs .code-fold').length,
    chip: document.getElementById('chatModelChip').textContent,
  }));
  console.log('CODE:', JSON.stringify(code), '| body:', JSON.stringify(captured));
  await p.screenshot({ path: '/tmp/render/unified-code.png', fullPage: false });

  // --- 3. REAL brain: knowledge question, no mode picked ---
  await p.unroute('**/api/chat');
  await fr.evaluate(() => { showView('home'); });
  await p.waitForTimeout(400);
  await fr.evaluate(() => document.getElementById('btnProject').click());
  await p.waitForTimeout(400);
  await fr.evaluate(() => { document.getElementById('chatInput').value = 'who is the president of France right now?'; });
  await fr.evaluate(() => document.getElementById('chatForm').dispatchEvent(new Event('submit', { cancelable: true })));
  let done = false;
  for (let i = 0; i < 50 && !done; i++) {
    await p.waitForTimeout(2000);
    done = await fr.evaluate(() => !document.querySelector('#msgs .dots') &&
      (Array.from(document.querySelectorAll('#msgs .msg.a .bubble')).pop() || { textContent: '' }).textContent.length > 20);
  }
  await p.waitForTimeout(1200);
  const qa = await fr.evaluate(() => ({
    chip: document.getElementById('chatModelChip').textContent,
    ans: (Array.from(document.querySelectorAll('#msgs .msg.a .bubble')).pop() || {}).textContent || '',
    retry: document.querySelectorAll('#msgs .retry-btn').length,
  }));
  console.log('QNA :', qa.chip, '|', qa.ans.slice(0, 220).replace(/\n/g, ' | '));
  await p.screenshot({ path: '/tmp/render/unified-qna.png', fullPage: false });
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

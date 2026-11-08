const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  fs.mkdirSync('/tmp/render', { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2200);
  const fr = p.frames().find(f => f !== p.mainFrame());

  // --- 1. home hero: open the mode menu, expect 4 options ---
  const optCount = await fr.evaluate(() => {
    document.getElementById('modeBtn').click();
    return document.querySelectorAll('.mode-opt').length;
  });
  await p.waitForTimeout(500);
  const mb = await fr.evaluate(() => {
    const r = document.getElementById('modeRow').getBoundingClientRect();
    return { x: Math.max(0, r.x - 140), y: Math.max(0, r.y - 60), width: 520, height: 400 };
  });
  await p.screenshot({ path: '/tmp/render/modes4-menu.png', clip: mb });
  console.log('mode options   :', optCount);

  // --- 2. pick Debug Mode, confirm state ---
  await fr.evaluate(() => document.querySelector('.mode-opt[data-mode="debug"]').click());
  await p.waitForTimeout(400);
  const cur = await fr.evaluate(() => document.getElementById('modeCur').textContent);
  const ls = await fr.evaluate(() => { try { return JSON.parse(localStorage.getItem('xrcode.v1')).mode; } catch (e) { return null; } });
  console.log('modeCur        :', cur, '| stored mode:', ls);

  // --- 3. chat: mocked coder reply carrying a fenced code block ---
  let captured = null;
  await p.route('**/api/chat', async route => {
    captured = route.request().postDataJSON();
    const code = ['function add(a, b) {', '  const s = a + b;', '  if (!Number.isFinite(s)) throw new Error("nan");', '  return s;', '}', '', 'console.log(add(2, 3));'].join('\n');
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, text: 'Here is the fix:\n```js\n' + code + '\n```' }) });
  });
  await fr.evaluate(() => document.getElementById('btnProject').click());
  await p.waitForTimeout(500);
  await fr.evaluate(() => { document.getElementById('chatInput').value = 'fix my add function'; });
  await fr.evaluate(() => document.getElementById('chatForm').dispatchEvent(new Event('submit', { cancelable: true })));
  await p.waitForTimeout(3000);

  const st = await fr.evaluate(() => {
    const wrap = document.querySelector('#msgs .code-wrap');
    return {
      hasWrap: !!wrap,
      saveBtns: document.querySelectorAll('#msgs .code-save').length,
      foldBtns: document.querySelectorAll('#msgs .code-fold').length,
      name: wrap ? wrap.querySelector('.code-name').textContent : null,
      bodyH: wrap ? wrap.querySelector('.code-body').getBoundingClientRect().height : 0,
      modeSent: null,
    };
  });
  console.log('code block     :', JSON.stringify(st), '| api mode:', captured && captured.mode);

  await p.screenshot({ path: '/tmp/render/modes4-code.png', fullPage: false });

  // --- 4. fold it ---
  await fr.evaluate(() => document.querySelector('#msgs .code-fold').click());
  await p.waitForTimeout(500);
  const foldedH = await fr.evaluate(() => document.querySelector('#msgs .code-body').getBoundingClientRect().height);
  console.log('folded height  :', foldedH);
  await p.screenshot({ path: '/tmp/render/modes4-folded.png', fullPage: false });

  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

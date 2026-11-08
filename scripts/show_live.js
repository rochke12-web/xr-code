const { chromium } = require('playwright');
(async () => {
  fs = require('fs'); fs.mkdirSync('/tmp/render', { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2200);
  const fr = p.frames().find(f => f !== p.mainFrame());
  // NO mocks — everything below is the real hosted brain

  // 1. home hero + 4-mode menu
  await fr.evaluate(() => document.getElementById('modeBtn').click());
  await p.waitForTimeout(500);
  const mb = await fr.evaluate(() => {
    const r = document.getElementById('modeRow').getBoundingClientRect();
    return { x: Math.max(0, r.x - 140), y: Math.max(0, r.y - 60), width: 520, height: 400 };
  });
  await p.screenshot({ path: '/tmp/render/show-modes.png', clip: mb });
  await fr.evaluate(() => document.querySelector('.mode-opt[data-mode="qna"]').click());
  await p.waitForTimeout(400);

  // 2. QnA live: real web-search answer
  await fr.evaluate(() => document.getElementById('btnProject').click());
  await p.waitForTimeout(400);
  await fr.evaluate(() => { document.getElementById('chatInput').value = 'who is the richest person in the world right now?'; });
  await fr.evaluate(() => document.getElementById('chatForm').dispatchEvent(new Event('submit', { cancelable: true })));
  let done = false;
  for (let i = 0; i < 40 && !done; i++) {          // poll up to ~80s (search + slow typing)
    await p.waitForTimeout(2000);
    done = await fr.evaluate(() => !document.querySelector('#msgs .dots') &&
      (Array.from(document.querySelectorAll('#msgs .msg.a .bubble')).pop() || { textContent: '' }).textContent.length > 20);
  }
  await p.waitForTimeout(1500);                     // let typing finish
  const q = await fr.evaluate(() => ({
    chip: document.getElementById('chatModelChip').textContent,
    ans: (Array.from(document.querySelectorAll('#msgs .msg.a .bubble')).pop() || {}).textContent || '',
  }));
  console.log('QNA chip:', q.chip);
  console.log('QNA ans :', q.ans.slice(0, 220).replace(/\n/g, ' | '));
  await p.screenshot({ path: '/tmp/render/show-qna.png', fullPage: false });

  // 3. Coder live: code block with fold arrow
  await fr.evaluate(() => document.querySelector('.nav [data-view="chat"], #btnProject') ? null : null);
  await fr.evaluate(() => { try { window.__setMode && window.__setMode('coder'); } catch (e) {} });
  await fr.evaluate(() => { document.getElementById('chatInput').value = 'write a js function that reverses a string'; });
  await fr.evaluate(() => document.getElementById('chatForm').dispatchEvent(new Event('submit', { cancelable: true })));
  done = false;
  for (let i = 0; i < 40 && !done; i++) {
    await p.waitForTimeout(2000);
    done = await fr.evaluate(() => !document.querySelector('#msgs .dots') && document.querySelectorAll('#msgs .code-wrap').length >= 1);
  }
  await p.waitForTimeout(1500);
  const c = await fr.evaluate(() => ({
    wraps: document.querySelectorAll('#msgs .code-wrap').length,
    saves: document.querySelectorAll('#msgs .code-save').length,
    folds: document.querySelectorAll('#msgs .code-fold').length,
  }));
  console.log('CODER blocks:', JSON.stringify(c));
  await p.screenshot({ path: '/tmp/render/show-coder.png', fullPage: false });
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

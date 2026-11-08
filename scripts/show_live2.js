const { chromium } = require('playwright');
(async () => {
  fs = require('fs'); fs.mkdirSync('/tmp/render', { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2200);
  const fr = p.frames().find(f => f !== p.mainFrame());
  // NO mocks — real hosted brain end to end

  // 1. home hero with the 4-mode menu open
  await fr.evaluate(() => document.getElementById('modeBtn').click());
  await p.waitForTimeout(500);
  const mb = await fr.evaluate(() => {
    const r = document.getElementById('modeRow').getBoundingClientRect();
    return { x: Math.max(0, r.x - 140), y: Math.max(0, r.y - 60), width: 520, height: 400 };
  });
  await p.screenshot({ path: '/tmp/render/show2-modes.png', clip: mb });

  // 2. QnA Mode: live web answer
  await fr.evaluate(() => document.querySelector('.mode-opt[data-mode="qna"]').click());
  await p.waitForTimeout(400);
  await fr.evaluate(() => document.getElementById('btnProject').click());
  await p.waitForTimeout(400);
  await fr.evaluate(() => { document.getElementById('chatInput').value = 'who is the richest person in the world right now?'; });
  await fr.evaluate(() => document.getElementById('chatForm').dispatchEvent(new Event('submit', { cancelable: true })));
  let done = false;
  for (let i = 0; i < 45 && !done; i++) {
    await p.waitForTimeout(2000);
    done = await fr.evaluate(() => !document.querySelector('#msgs .dots') &&
      (Array.from(document.querySelectorAll('#msgs .msg.a .bubble')).pop() || { textContent: '' }).textContent.length > 20);
  }
  await p.waitForTimeout(1500);
  const q = await fr.evaluate(() => ({
    chip: document.getElementById('chatModelChip').textContent,
    ans: (Array.from(document.querySelectorAll('#msgs .msg.a .bubble')).pop() || {}).textContent || '',
  }));
  console.log('QNA :', q.chip, '|', q.ans.slice(0, 150).replace(/\n/g, ' | '));
  await p.screenshot({ path: '/tmp/render/show2-qna.png', fullPage: false });

  // 3. switch to Coder Mode (real UI path) and ask for code
  await fr.evaluate(() => { showView('home'); });
  await p.waitForTimeout(400);
  await fr.evaluate(() => document.getElementById('modeBtn').click());
  await p.waitForTimeout(300);
  await fr.evaluate(() => document.querySelector('.mode-opt[data-mode="coder"]').click());
  await p.waitForTimeout(300);
  await fr.evaluate(() => { showView('chat'); });
  await p.waitForTimeout(400);
  await fr.evaluate(() => { document.getElementById('chatInput').value = 'write a js function that reverses a string'; });
  await fr.evaluate(() => document.getElementById('chatForm').dispatchEvent(new Event('submit', { cancelable: true })));
  done = false;
  for (let i = 0; i < 45 && !done; i++) {
    await p.waitForTimeout(2000);
    done = await fr.evaluate(() => !document.querySelector('#msgs .dots') && document.querySelectorAll('#msgs .code-wrap').length >= 1);
  }
  await p.waitForTimeout(1500);
  const c = await fr.evaluate(() => ({
    chip: document.getElementById('chatModelChip').textContent,
    wraps: document.querySelectorAll('#msgs .code-wrap').length,
    saves: document.querySelectorAll('#msgs .code-save').length,
    folds: document.querySelectorAll('#msgs .code-fold').length,
    raw: Array.from(document.querySelectorAll('#msgs .bubble')).filter(b => b.textContent.includes('```')).length,
  }));
  console.log('CODER:', JSON.stringify(c));
  await p.screenshot({ path: '/tmp/render/show2-coder.png', fullPage: false });
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

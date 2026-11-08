const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2300);
  const fr = p.frames().find(f => f !== p.mainFrame());

  const box = await fr.evaluate(() => {
    const r = document.getElementById('modeRow').getBoundingClientRect();
    return { x: Math.round(r.left) - 40, y: Math.round(r.top) - 90, width: 340, height: 210 };
  });

  // closed state
  let closed = await fr.evaluate(() => {
    const m = document.querySelector('.mode-menu');
    const cs = getComputedStyle(m);
    return { label: document.getElementById('modeCur').textContent, opacity: cs.opacity, open: document.getElementById('modeRow').classList.contains('open') };
  });
  console.log('closed        :', JSON.stringify(closed));
  await p.screenshot({ path: '/tmp/render/dd-closed.png', clip: box });

  // open the combobox
  await fr.evaluate(() => document.getElementById('modeBtn').click());
  await p.waitForTimeout(400);
  let open = await fr.evaluate(() => {
    const m = document.querySelector('.mode-menu');
    return { opacity: getComputedStyle(m).opacity, open: document.getElementById('modeRow').classList.contains('open'),
             opts: Array.from(m.querySelectorAll('.mode-opt .ol')).map(e => e.textContent) };
  });
  console.log('open          :', JSON.stringify(open));
  await p.screenshot({ path: '/tmp/render/dd-open.png', clip: box });

  // pick QnA
  await fr.evaluate(() => document.querySelector('.mode-opt[data-mode="qna"]').click());
  await p.waitForTimeout(350);
  const picked = await fr.evaluate(() => ({ label: document.getElementById('modeCur').textContent, open: document.getElementById('modeRow').classList.contains('open') }));
  console.log('picked QnA    :', JSON.stringify(picked));

  // now test AI file write: mocked reply with python code
  let sent = null;
  await p.route('**/api/chat', async route => {
    sent = route.request().postDataJSON();
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, text: 'Here you go:\n```python\ndef fib(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a\n```\nDone.' }) });
  });
  await fr.evaluate(() => document.getElementById('btnProject').click());
  await p.waitForTimeout(400);
  await fr.evaluate(() => { document.getElementById('chatInput').value = 'give me fibonacci in python'; });
  await fr.evaluate(() => document.getElementById('chatForm').dispatchEvent(new Event('submit', { cancelable: true })));
  await p.waitForTimeout(4000);
  const cb = await fr.evaluate(() => {
    const bar = document.querySelector('#msgs .code-bar');
    return {
      exists: !!bar,
      name: bar ? bar.querySelector('.code-name').textContent : null,
      hasSave: !!document.querySelector('#msgs .code-save'),
    };
  });
  console.log('code block    :', JSON.stringify(cb), '| api mode:', sent && sent.mode, '| chip:', await fr.evaluate(() => document.getElementById('chatModelChip').textContent));

  // trigger the download
  const [dl] = await Promise.all([
    p.waitForEvent('download', { timeout: 8000 }),
    fr.evaluate(() => document.querySelector('#msgs .code-save').click()),
  ]);
  const path = '/tmp/render/' + dl.suggestedFilename();
  await dl.saveAs(path);
  console.log('download      :', dl.suggestedFilename(), '| content ok:', fs.readFileSync(path, 'utf8').includes('def fib'));
  await p.screenshot({ path: '/tmp/render/dd-code.png', clip: { x: 300, y: 60, width: 1140, height: 560 } });
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

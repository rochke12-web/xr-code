const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2600);

  let fr = null;                                  // pick the REAL app frame by content
  for (let round = 0; round < 5 && !fr; round++) {
    for (const f of p.frames()) {
      if (f === p.mainFrame()) continue;
      if (await f.evaluate(() => !!document.getElementById('modeRow')).catch(() => false)) { fr = f; break; }
    }
    if (!fr) await p.waitForTimeout(1200);
  }
  if (!fr) throw new Error('app frame not found');
  console.log('A: app frame locked');

  await fr.evaluate(() => document.getElementById('modeBtn').click());
  console.log('B: dropdown open');
  await p.waitForTimeout(350);
  const open = await fr.evaluate(() => ({
    opacity: getComputedStyle(document.querySelector('.mode-menu')).opacity,
    opts: Array.from(document.querySelectorAll('.mode-opt .ol')).map(e => e.textContent),
  }));
  console.log('C: menu', JSON.stringify(open));
  await p.screenshot({ path: '/tmp/render/dd-open.png', clip: { x: 700, y: 380, width: 420, height: 260 } });

  await fr.evaluate(() => document.querySelector('.mode-opt[data-mode="qna"]').click());
  await p.waitForTimeout(350);
  console.log('D: label now =', await fr.evaluate(() => document.getElementById('modeCur').textContent));

  let sent = null;
  await p.route('**/api/chat', async route => {
    sent = route.request().postDataJSON();
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, text: 'Here:\n```python\ndef fib(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a\n```' }) });
  });
  await fr.evaluate(() => document.getElementById('btnProject').click());
  await p.waitForTimeout(500);
  await fr.evaluate(() => { document.getElementById('chatInput').value = 'give me fibonacci'; });
  await fr.evaluate(() => document.getElementById('chatForm').dispatchEvent(new Event('submit', { cancelable: true })));
  console.log('E: sent, mode =', sent && sent.mode, '| chip =', await fr.evaluate(() => document.getElementById('chatModelChip').textContent));
  await p.waitForTimeout(4500);

  const cb = await fr.evaluate(() => {
    const bar = document.querySelector('#msgs .code-bar');
    return { name: bar ? bar.querySelector('.code-name').textContent : null, save: !!document.querySelector('#msgs .code-save') };
  });
  console.log('F: code bar', JSON.stringify(cb));

  const [dl] = await Promise.all([
    p.waitForEvent('download', { timeout: 8000 }),
    fr.evaluate(() => document.querySelector('#msgs .code-save').click()),
  ]);
  const path = '/tmp/render/' + dl.suggestedFilename();
  await dl.saveAs(path);
  console.log('G: download', dl.suggestedFilename(), '| fib ok:', fs.readFileSync(path, 'utf8').includes('def fib'));
  await p.screenshot({ path: '/tmp/render/dd-code.png', clip: { x: 300, y: 60, width: 1140, height: 560 } });
  console.log('H: done');
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exitCode = 1; });

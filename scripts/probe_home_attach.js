const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  fs.writeFileSync('/tmp/app.py', 'def add(a, b):\n    return a + b\n');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2200);
  const fr = p.frames().find(f => f !== p.mainFrame());

  let captured = null;
  await p.route('**/api/chat', async route => {
    captured = route.request().postDataJSON();
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, text: 'Your add() looks correct — returns a + b.' }) });
  });

  // HOME: attach via the home paperclip
  await fr.setInputFiles('input[type=file]', ['/tmp/app.py']);
  await p.waitForTimeout(600);
  const homeChips = await fr.evaluate(() => Array.from(document.querySelectorAll('#homeForm .attach-row .att-chip .nm')).map(e => e.textContent));
  const btnPos = await fr.evaluate(() => {
    const s = document.querySelector('#homeForm .send-btn').getBoundingClientRect();
    const f = document.getElementById('homeFileBtn').getBoundingClientRect();
    return { sendRight: Math.round(s.right), fileLeft: Math.round(f.left), fileRightOfSend: f.left >= s.right - 2 };
  });
  console.log('home chips     :', JSON.stringify(homeChips), '| paperclip right of send:', btnPos.fileRightOfSend, JSON.stringify(btnPos));
  await p.screenshot({ path: '/tmp/render/home-attach.png', clip: { x: 300, y: 300, width: 840, height: 320 } });

  // submit from home -> should land in chat with the attachment sent
  await fr.evaluate(() => { document.getElementById('homeInput').value = 'Check this python file'; });
  await fr.evaluate(() => document.getElementById('homeForm').dispatchEvent(new Event('submit', { cancelable: true })));
  await p.waitForTimeout(3500);

  const state = await fr.evaluate(() => {
    const lastU = Array.from(document.querySelectorAll('#msgs .msg.u')).pop();
    return {
      view: document.querySelector('.view.active').id,
      bubbleChips: lastU ? Array.from(lastU.querySelectorAll('.att-chip .nm')).map(e => e.textContent) : null,
      homeRowEmpty: document.querySelectorAll('#homeForm .attach-row .att-chip').length === 0,
      chatRowEmpty: document.querySelectorAll('#chatForm .attach-row .att-chip').length === 0,
    };
  });
  console.log('after send     :', JSON.stringify(state));
  const lastMsg = captured && captured.messages[captured.messages.length - 1];
  console.log('api got file   :', /attached file: app\.py/.test(lastMsg.content) && /def add/.test(lastMsg.content));
  await p.screenshot({ path: '/tmp/render/home-sent.png', clip: { x: 300, y: 60, width: 1140, height: 560 } });
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

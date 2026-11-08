const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  // tiny test assets
  fs.writeFileSync('/tmp/notes.txt', 'function hello(){ return "world"; }\n// XR CODE test file\nconst answer = 42;\n');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAF0lEQVR4nGP8z8Dwn4GBgYGJAQwAHxcCAmXfLkIAAAAASUVORK5CYII=', 'base64');
  fs.writeFileSync('/tmp/pic.png', png);

  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2200);
  const fr = p.frames().find(f => f !== p.mainFrame());

  // mock the hosted brain, capture the payload
  let captured = null;
  await p.route('**/api/chat', async route => {
    captured = route.request().postDataJSON();
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, text: 'Got your files — I read notes.txt and can see pic.png.' }) });
  });

  // go to chat
  await fr.evaluate(() => document.getElementById('btnProject').click());
  await p.waitForTimeout(500);

  // attach 2 files via the hidden picker
  await fr.setInputFiles('input[type=file]', ['/tmp/notes.txt', '/tmp/pic.png']);
  await p.waitForTimeout(600);
  const chips = await fr.evaluate(() => Array.from(document.querySelectorAll('.attach-row .att-chip .nm')).map(e => e.textContent));
  console.log('composer chips :', JSON.stringify(chips));

  await p.screenshot({ path: '/tmp/render/att-composer.png', clip: { x: 0, y: 640, width: 1060, height: 260 } });

  // send
  await fr.evaluate(() => { document.getElementById('chatInput').value = 'Please review my files'; });
  await fr.evaluate(() => document.getElementById('chatForm').dispatchEvent(new Event('submit', { cancelable: true })));
  await p.waitForTimeout(3500);

  const state = await fr.evaluate(() => {
    const lastU = Array.from(document.querySelectorAll('#msgs .msg.u')).pop();
    return {
      bubbleChips: lastU ? Array.from(lastU.querySelectorAll('.att-chip .nm')).map(e => e.textContent) : null,
      hasThumb: !!lastU.querySelector('.att-chip img'),
      rowHidden: getComputedStyle(document.querySelector('.attach-row')).display === 'none',
      reply: (Array.from(document.querySelectorAll('#msgs .msg.a .bubble')).pop() || {}).textContent || '',
    };
  });
  console.log('bubble chips   :', JSON.stringify(state.bubbleChips), '| thumb:', state.hasThumb, '| row cleared:', state.rowHidden);
  console.log('ai reply       :', state.reply.slice(0, 60));
  const lastMsg = captured && captured.messages[captured.messages.length - 1];
  console.log('api last msg   :', JSON.stringify(lastMsg.content.slice(0, 140)));
  console.log('api got file   :', /attached file: notes\.txt/.test(lastMsg.content) && /function hello/.test(lastMsg.content));
  console.log('api got image  :', /attached image: pic\.png/.test(lastMsg.content));

  await p.screenshot({ path: '/tmp/render/att-sent.png', fullPage: false });
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

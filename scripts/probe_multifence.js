const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2200);
  const fr = p.frames().find(f => f !== p.mainFrame());
  await p.route('**/api/chat', async route => {
    const text = ['Here is the loop version:', '```js\nfunction rev(s){let r="";for(let i=s.length-1;i>=0;i--)r+=s[i];return r;}\n```', 'And the recursive one:', '```js\nconst rev2=s=>s===""?"":rev2(s.substr(1))+s[0];\n```', 'Both work fine.'].join('\n');
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, text }) });
  });
  await fr.evaluate(() => document.getElementById('btnProject').click());
  await p.waitForTimeout(400);
  await fr.evaluate(() => { document.getElementById('chatInput').value = 'give me two ways'; });
  await fr.evaluate(() => document.getElementById('chatForm').dispatchEvent(new Event('submit', { cancelable: true })));
  await p.waitForTimeout(9000);
  const st = await fr.evaluate(() => ({
    wraps: document.querySelectorAll('#msgs .code-wrap').length,
    bubbles: document.querySelectorAll('#msgs .msg.a .bubble').length,
    rawFences: Array.from(document.querySelectorAll('#msgs .msg.a .bubble')).filter(b => b.textContent.includes('```')).length,
  }));
  console.log('multi-fence    :', JSON.stringify(st), '(expect wraps:2, bubbles:3, rawFences:0)');
  await p.screenshot({ path: '/tmp/render/multifence.png', fullPage: false });
  await p.reload();
  await p.waitForTimeout(2500);
  const fr2 = p.frames().find(f => f !== p.mainFrame());
  await fr2.evaluate(() => { if (typeof showView === 'function') showView('chat'); });
  await p.waitForTimeout(600);
  const st2 = await fr2.evaluate(() => ({
    wraps: document.querySelectorAll('#msgs .code-wrap').length,
    bubbles: document.querySelectorAll('#msgs .msg.a .bubble').length,
    rawFences: Array.from(document.querySelectorAll('#msgs .msg.a .bubble')).filter(b => b.textContent.includes('```')).length,
  }));
  console.log('after reload   :', JSON.stringify(st2), '(expect wraps:2, bubbles:3, rawFences:0)');
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
// appended: reload persistence check happens in a second pass below

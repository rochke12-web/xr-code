const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2200);
  const fr = p.frames().find(f => f !== p.mainFrame());
  await p.route('**/api/chat', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, text: 'Hello! I am XR Code — ask me anything.' }),
  }));
  await fr.evaluate(() => document.getElementById('btnProject').click());
  await p.waitForTimeout(500);
  await fr.evaluate(() => { document.getElementById('chatInput').value = 'hello'; });
  await fr.evaluate(() => document.getElementById('chatForm').dispatchEvent(new Event('submit', { cancelable: true })));
  await p.waitForTimeout(4500);
  const st = await fr.evaluate(() => ({
    emptyBig: !!Array.from(document.querySelectorAll('.big')).find(e => e.textContent.includes('XR Code')),
    who: (document.querySelector('#msgs .msg.a .who') || {}).textContent,
    chip: document.getElementById('chatModelChip').textContent,
    appBrand: document.getElementById('brandTitle').textContent,
  }));
  console.log(JSON.stringify(st));
  await p.screenshot({ path: '/home/z/my-project/download/preview-3-ai-name.png', fullPage: false });
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

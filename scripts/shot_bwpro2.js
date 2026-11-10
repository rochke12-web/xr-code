const { chromium } = require('playwright');
const unlock = () => { const f = document.querySelector('iframe'); const w = f && f.contentWindow; if (w && w.dsHideLock) w.dsHideLock(); };
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const p = await b.newPage({ viewport: { width: 1360, height: 850 } });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1600);
  await p.evaluate(unlock);
  const fr = p.frames().find(f => f !== p.mainFrame()) || p.mainFrame();
  await fr.evaluate(() => { if (window.dsHideLock) window.dsHideLock(); });
  await p.waitForTimeout(300);

  // inject a realistic conversation and render it
  await fr.evaluate(() => {
    const c = currentChat();
    c.messages.push(
      { r: 'u', t: 'Build me a black & white landing page with a hero and a CTA button.' },
      { r: 'a', t: 'Here you go — a strict monochrome landing page. Save it as index.html and open it in any browser.' },
      { r: 'a', t: '', code: '<!DOCTYPE html>\n<html>\n<body style="background:#000;color:#fff">\n  <h1>XR-Code</h1>\n  <button>Start now</button>\n</body>\n</html>' },
      { r: 'a', t: 'Tip: the button uses a hover lift — press it to feel the ripple.' }
    );
    renderChat(); showView('chat');
  });
  await p.waitForTimeout(800);
  await p.screenshot({ path: '/tmp/render/bw2-chat-msgs.png' });

  // model menu open state
  await fr.evaluate(() => document.getElementById('chatModelBtn').click());
  await p.waitForTimeout(500);
  await p.screenshot({ path: '/tmp/render/bw2-mmenu.png' });
  await fr.evaluate(() => document.body.click());
  await p.waitForTimeout(200);

  // light theme conversation
  await fr.evaluate(() => document.getElementById('themeQuick').click());
  await p.waitForTimeout(1000);
  await p.screenshot({ path: '/tmp/render/bw2-chat-msgs-light.png' });
  await fr.evaluate(() => document.getElementById('themeQuick').click());
  await p.waitForTimeout(800);

  // mobile: unlocked home + chat
  const m = await b.newPage({ viewport: { width: 390, height: 800 } });
  m.on('pageerror', e => errs.push('m pageerror: ' + e.message));
  await m.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await m.waitForTimeout(1500);
  await m.evaluate(unlock);
  const mf = m.frames().find(f => f !== m.mainFrame()) || m.mainFrame();
  await mf.evaluate(() => { if (window.dsHideLock) window.dsHideLock(); });
  await m.waitForTimeout(400);
  await m.screenshot({ path: '/tmp/render/bw2-mobile-home.png' });
  await mf.evaluate(() => {
    const c = currentChat();
    c.messages.push({ r: 'u', t: 'Show me a monochrome button style.' }, { r: 'a', t: 'Here is a clean B&W button with a hover lift and press ripple — monochrome, sharp, professional.' });
    renderChat(); showView('chat');
  });
  await m.waitForTimeout(700);
  await m.screenshot({ path: '/tmp/render/bw2-mobile-chat.png' });

  await b.close();
  console.log('sweep2 done');
  errs.slice(0, 6).forEach(e => console.log('ERR', e));
  if (!errs.length) console.log('no js errors');
})();

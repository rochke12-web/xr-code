/* probe: GLM full engine e2e — image generation + sandbox run, live through /api/chat */
const { chromium } = require('playwright');

(async () => {
  const results = [];
  const ok = (n, c, extra) => { results.push({ n, ok: !!c }); console.log((c ? 'PASS' : 'FAIL') + ' - ' + n + (extra ? ' | ' + extra : '')); };

  const browser = await chromium.launch();
  const pg = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  pg.on('pageerror', e => errors.push(String(e)));

  await pg.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 45000 });
  await pg.waitForTimeout(1200);
  const frame = pg.frames().find(f => f !== pg.mainFrame());
  if (!frame) { console.log('FAIL - no app frame'); process.exit(1); }

  // ---------- TEST 1: real image generation ----------
  await frame.fill('#homeInput', 'generate a photo of a red apple on a white table');
  await frame.click('#homeForm .send-btn');
  await frame.waitForSelector('#chatInput', { timeout: 15000 });
  console.log('sent image request, waiting for generation (up to 170s)...');
  let imgOk = false;
  try {
    await frame.waitForSelector('.msg.a img[src*="/api/asset/"]', { timeout: 170000 });
    imgOk = true;
  } catch { imgOk = false; }
  const reply1 = await frame.evaluate(() => [...document.querySelectorAll('.msg.a .bubble')].map(b => b.textContent.trim()).pop() || '');
  ok('image generated + shown in chat', imgOk);
  ok('no raw action JSON leaked', !/{"action"\s*:\s*"image"/.test(reply1), reply1.slice(0, 90));
  await pg.screenshot({ path: 'scripts/preview-31-imagegen.png', fullPage: false });

  // ---------- TEST 2: sandbox run of a generated HTML artifact ----------
  await frame.fill('#chatInput', 'make a tiny html page with one blue button that says Hello');
  await frame.click('#chatForm .send-btn');
  console.log('sent html request, waiting for code block...');
  let codeOk = true;
  try { await frame.waitForSelector('.msg.a .code-wrap', { timeout: 90000 }); } catch { codeOk = false; }
  ok('html code block rendered', codeOk);
  if (codeOk) {
    await frame.click('.msg.a .code-wrap button[title="Run in sandbox"]');
    await pg.waitForTimeout(900);
    const sandboxOpen = await frame.evaluate(() => document.getElementById('sandboxBack').classList.contains('open'));
    const btnInFrame = await frame.evaluate(() => (document.getElementById('sandboxFrame').srcdoc || '').toLowerCase().includes('<button'));
    ok('sandbox opens', sandboxOpen);
    ok('artifact runs inside sandbox', btnInFrame);
    await pg.screenshot({ path: 'scripts/preview-32-sandbox.png' });
    await frame.click('#sandboxClose').catch(() => {});
  }

  ok('no page errors', errors.length === 0, errors.join('; ').slice(0, 160));
  await browser.close();
  const fails = results.filter(r => !r.ok).length;
  console.log(fails === 0 ? 'ALL PASS (' + results.length + ')' : fails + ' FAILURES');
  process.exit(fails === 0 ? 0 : 1);
})();

// Real-vision probe: chevron fix + photo vision + video keyframe vision (UI e2e)
const { chromium } = require('playwright');

const URL = 'http://localhost:3000/';
let pass = 0, fail = 0;
const ok = (cond, label) => { console.log((cond ? 'PASS ' : 'FAIL ') + label); cond ? pass++ : fail++; };

(async () => {
  const browser = await chromium.launch();
  const pg = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  pg.on('pageerror', e => errors.push(String(e)));

  await pg.goto(URL, { waitUntil: 'networkidle', timeout: 45000 });
  const frame = pg.frames().find(f => f !== pg.mainFrame()) || pg.mainFrame();

  // ---------- 1) chevron icon ----------
  const chevSym = await frame.evaluate(() => !!document.querySelector('symbol#i-chevd'));
  ok(chevSym, 'chevron symbol i-chevd in sprite');
  const pillIcons = await frame.evaluate(() =>
    [...document.querySelectorAll('.model-pill use')].map(u => u.getAttribute('href')));
  ok(pillIcons.filter(x => x === '#i-chevd').length === 2, 'both model pills use #i-chevd (' + JSON.stringify(pillIcons) + ')');
  const sendIc = await frame.evaluate(() => document.querySelector('#homeForm .send-btn use')?.getAttribute('href'));
  ok(sendIc === '#i-chev', 'home send button keeps right-chevron (got ' + sendIc + ')');
  const exportIc = await frame.evaluate(() =>
    [...document.querySelectorAll('use')].filter(u => u.getAttribute('href') === '#i-down').length);
  ok(exportIc >= 1, 'export button still uses download icon (' + exportIc + ' #i-down left)');

  // rotation on open
  await frame.click('#homeModelBtn');
  await pg.waitForTimeout(350);
  const rot = await frame.evaluate(() => {
    const el = document.querySelector('#homeModelBtn use[href="#i-chevd"]');
    return el ? getComputedStyle(el.parentElement).transform : 'missing';
  });
  ok(rot && rot !== 'none' && rot.includes('-1'), 'chevron rotates 180deg when menu open (' + rot.slice(0, 30) + ')');
  const menuOpen = await frame.evaluate(() => document.querySelector('#homeModelMenu').classList.contains('open'));
  ok(menuOpen, 'model menu opens');
  await pg.screenshot({ path: 'download/preview-22-chev-menu.png' });
  await frame.click('#homeModelMenu button[data-m="prime-v1-vision"]').catch(() => {});
  await pg.waitForTimeout(200);
  await frame.evaluate(() => document.body.click());
  await pg.waitForTimeout(200);

  // ---------- 2) photo vision (browser e2e) ----------
  const attached1 = await frame.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 360; cv.height = 150;
    const c = cv.getContext('2d');
    c.fillStyle = '#ffffff'; c.fillRect(0, 0, 360, 150);
    c.fillStyle = '#111111'; c.font = 'bold 54px sans-serif';
    c.fillText('MANGO-77', 24, 92);
    c.fillStyle = '#e02020'; c.beginPath(); c.arc(310, 60, 34, 0, 7); c.fill();
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    const f = new File([blob], 'drawing.png', { type: 'image/png' });
    const d = new DataTransfer(); d.items.add(f);
    const input = document.querySelector('#chatForm input[type=file]');
    input.files = d.files; input.dispatchEvent(new Event('change'));
    return { n: f.name, kb: Math.round(f.size / 1024) };
  });
  await pg.waitForTimeout(1500);
  const chip = await frame.evaluate(() => document.querySelectorAll('.attach-row .att-chip').length);
  ok(chip >= 1, 'attachment chip visible (' + attached1.n + ' ' + attached1.kb + 'KB, chips ' + chip + ')');

  await frame.fill('#homeInput', 'What text and what shape/color do you see in my picture? Answer in one short line.');
  await frame.click('#homeForm .send-btn');
  try {
    await frame.waitForSelector('.msg.a .bubble', { timeout: 90000 });
    await pg.waitForFunction(() => {
      const b = [...document.querySelectorAll('.msg.a .bubble')];
      const t = b.length ? b[b.length - 1].textContent : '';
      return t && t.length > 5 && !/^\s*\u2022*$/.test(t) && !document.querySelector('.dots');
    }, { timeout: 90000 });
  } catch (e) { /* timeout — check below */ }
  await pg.waitForTimeout(1500);
  const reply1 = await frame.evaluate(() => {
    const b = [...document.querySelectorAll('.msg.a .bubble')];
    return b.length ? b[b.length - 1].textContent : '';
  });
  ok(/mango/i.test(reply1), 'photo vision: reply reads MANGO-77 (' + reply1.slice(0, 90) + ')');
  ok(/red/i.test(reply1) || /circle/i.test(reply1), 'photo vision: reply mentions red/circle (' + reply1.slice(0, 90) + ')');

  // ---------- 3) video keyframe vision (browser e2e) ----------
  const attached2 = await frame.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 320; cv.height = 240;
    const c = cv.getContext('2d');
    const stream = cv.captureStream(20);
    const rec = new MediaRecorder(stream);
    const chunks = [];
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    const done = new Promise(r => { rec.onstop = r; });
    rec.start();
    const t0 = performance.now();
    await new Promise(res => {
      (function draw() {
        const t = (performance.now() - t0) / 1000;
        c.fillStyle = t < 0.6 ? '#20345c' : '#1d7a3a'; c.fillRect(0, 0, 320, 240);
        c.fillStyle = '#ffffff'; c.font = 'bold 58px sans-serif';
        c.fillText('VX-42', 88, 132);
        if (t < 1.6) requestAnimationFrame(draw); else res();
      })();
    });
    rec.stop();
    await done;
    const blob = new Blob(chunks, { type: 'video/webm' });
    const f = new File([blob], 'clip.webm', { type: 'video/webm' });
    const d = new DataTransfer(); d.items.add(f);
    const input = document.querySelector('#chatForm input[type=file]');
    input.files = d.files; input.dispatchEvent(new Event('change'));
    return { n: f.name, kb: Math.round(f.size / 1024) };
  });
  await pg.waitForTimeout(3500);
  const chip2 = await frame.evaluate(() => document.querySelectorAll('.attach-row .att-chip').length);
  ok(chip2 >= 1, 'video chip visible (' + attached2.n + ' ' + attached2.kb + 'KB, chips ' + chip2 + ')');

  await frame.fill('#chatInput', 'What text do you see in my video? Reply with just the text.');
  await frame.click('#chatForm .send-btn');
  try {
    await pg.waitForFunction(() => {
      const b = [...document.querySelectorAll('.msg.a .bubble')];
      return b.length >= 2 && !document.querySelector('.dots');
    }, { timeout: 120000 });
  } catch (e) { /* timeout — check below */ }
  await pg.waitForTimeout(1500);
  const reply2 = await frame.evaluate(() => {
    const b = [...document.querySelectorAll('.msg.a .bubble')];
    return b.length ? b[b.length - 1].textContent : '';
  });
  ok(/vx\s*-?\s*42/i.test(reply2), 'video vision: reply reads VX-42 (' + reply2.slice(0, 90) + ')');

  await pg.screenshot({ path: 'download/preview-23-vision-e2e.png', fullPage: false });

  ok(errors.length === 0, 'no page errors (' + errors.slice(0, 2).join('; ').slice(0, 120) + ')');
  console.log(`\n${pass} pass, ${fail} fail`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();

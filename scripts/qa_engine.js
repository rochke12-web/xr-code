// E2E: engine selection (client) + real Prime gateway routing (server).
// 1) UI: open chat model menu -> pick Prime Flash / Prime Vision -> state + chip + persistence
// 2) Server: POST /api/chat with a minted Discord gate cookie, model=prime-v1-flash
//    -> real /v1/messages call must answer ok:true (identity-locked reply)
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const crypto = require('crypto');

const ROOT = '/home/z/my-project/download';
const FILE = 'xr-code-private.html';
const PORT = 8127;
const APP_ORIGIN = 'http://localhost:3000';

// mint a valid gate cookie the same way the server does (v1.uid.iat.sig)
const SECRET = '0bb201eba83d12682c84c98e326eb3288dcbd6ff880293764c7084231413937f';
const uid = 'e2e-prime-test-uid';
const iat = Math.floor(Date.now() / 1000);
const sig = crypto.createHmac('sha256', SECRET).update(uid + '.' + iat).digest('hex').slice(0, 40);
const TOKEN = `v1.${uid}.${iat}.${sig}`;

const mime = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
const srv = http.createServer((req, res) => {
  const n = req.url === '/' ? FILE : decodeURIComponent(req.url.split('?')[0].slice(1));
  const fp = path.join(ROOT, n);
  if (!fs.existsSync(fp)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': mime[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});

(async () => {
  const fails = [];
  const ok = (c, l) => { console.log((c ? 'PASS' : 'FAIL') + '  ' + l); if (!c) fails.push(l); };

  // ---------- 1) UI engine selection ----------
  await new Promise(r => srv.listen(PORT, r));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1360, height: 850 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('**/api/discord/check', r => r.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, uid, invite: 'https://discord.gg/YPqmsrMRr5', roleId: '111222333444555666', owner: false }),
  }));
  await p.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load' });
  await p.waitForTimeout(1400);
  await p.evaluate(() => { showView('chat'); });
  await p.waitForTimeout(300);
  await p.evaluate(() => document.getElementById('chatModelBtn').click());
  await p.waitForTimeout(400);
  const menuOpen = await p.evaluate(() => document.getElementById('chatModeMenu').classList.contains('open'));
  ok(menuOpen, 'U1 model menu opens');
  const engineBtns = await p.evaluate(() => Array.from(document.querySelectorAll('#chatModeMenu button[data-model]')).map(x => x.dataset.model));
  ok(JSON.stringify(engineBtns) === JSON.stringify(['auto', 'prime-v1-flash', 'prime-v1-vision']), 'U2 engine buttons present: ' + engineBtns.join(','));
  await p.screenshot({ path: '/tmp/render/qa-engine-menu.png' });
  await p.evaluate(() => { document.querySelector('#chatModeMenu button[data-model="prime-v1-flash"]').click(); });
  await p.waitForTimeout(400);
  const st1 = await p.evaluate(() => ({ m: JSON.parse(localStorage.getItem('xrcode.v1')).model, chip: document.getElementById('chatModelChip').textContent }));
  ok(st1.m === 'prime-v1-flash', 'U3 Prime Flash persisted in state');
  ok(st1.chip === 'Prime Flash', 'U4 chip shows "Prime Flash": ' + st1.chip);
  // switch to Prime Vision
  await p.evaluate(() => document.getElementById('chatModelBtn').click());
  await p.waitForTimeout(250);
  await p.evaluate(() => { document.querySelector('#chatModeMenu button[data-model="prime-v1-vision"]').click(); });
  await p.waitForTimeout(350);
  const st2 = await p.evaluate(() => ({ m: JSON.parse(localStorage.getItem('xrcode.v1')).model, chip: document.getElementById('chatModelChip').textContent }));
  ok(st2.m === 'prime-v1-vision' && st2.chip === 'Prime Vision', 'U5 Prime Vision selected + chip updated');
  // back to Auto
  await p.evaluate(() => document.getElementById('chatModelBtn').click());
  await p.waitForTimeout(250);
  await p.evaluate(() => { document.querySelector('#chatModeMenu button[data-model="auto"]').click(); });
  await p.waitForTimeout(350);
  const st3 = await p.evaluate(() => ({ m: JSON.parse(localStorage.getItem('xrcode.v1')).model, chip: document.getElementById('chatModelChip').textContent }));
  ok(st3.m === 'auto' && st3.chip === 'Hosted by Z.ai', 'U6 Auto restored + chip back to hosted');
  // migration: stale glm-4.6 -> auto
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('xrcode.v1')); s.model = 'glm-4.6'; localStorage.setItem('xrcode.v1', JSON.stringify(s)); });
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(1200);
  const st4 = await p.evaluate(() => JSON.parse(localStorage.getItem('xrcode.v1')).model);
  ok(st4 === 'auto', 'U7 legacy glm-4.6 migrates to auto');
  ok(errs.length === 0, 'U8 zero JS errors (UI flow)' + (errs.length ? ' -> ' + errs.join(' ; ') : ''));
  await p.close();
  await b.close();
  srv.close();

  // ---------- 2) live server routing (production server on :3000) ----------
  const ask = async (model) => {
    const r = await fetch(APP_ORIGIN + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': 'xr_ds=' + encodeURIComponent(TOKEN) },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Reply with exactly: PRIME-OK' }], model, mode: 'koder' }),
    });
    return r.json();
  };
  try {
    const d1 = await ask('prime-v1-flash');
    ok(d1 && d1.ok && /PRIME-OK/i.test(d1.text || ''), 'S1 live: prime-v1-flash answers via gateway: "' + String(d1.text || '').slice(0, 60) + '"');
    const d2 = await ask('prime-v1-vision');
    ok(d2 && d2.ok && !!(d2.text || '').trim(), 'S2 live: prime-v1-vision answers: "' + String(d2.text || '').slice(0, 60) + '"');
    const d3 = await ask('auto');
    ok(d3 && d3.ok && !!(d3.text || '').trim(), 'S3 live: auto (Z.ai brain) still answers: "' + String(d3.text || '').slice(0, 50) + '"');
  } catch (e) {
    ok(false, 'S* live server not reachable on :3000 -> ' + e.message);
  }

  console.log(fails.length ? '\n*** ' + fails.length + ' FAILURE(S) ***' : '\nALL ENGINE QA PASSED');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('QA crashed:', e); process.exit(2); });

// QA: three Prime engines (prime-v1 / prime-v1-flash / prime-vision).
//  Browser part (static harness like qa_pinrole.js): T1 menu ids, T2 intercepted
//  /api/chat bodies per engine, T3 chips + toast, T4 legacy prime-v1-vision remap.
//  Node part (REAL server :3000): T5 minted-cookie chat for all three models —
//  the production chain already traced to the gateway via prime_trace_proxy.js.
const { chromium } = require('playwright');
const { createHmac } = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = '/home/z/my-project/download';
const FILE = 'xr-code-private.html';
const PORT = 8125;
const LIVE = 'http://localhost:3000';
const UID = '123456789012345678';

const mime = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.js': 'text/javascript', '.css': 'text/css' };

function mint(uid) {
  const src = fs.readFileSync('/home/z/my-project/src/lib/xrsecrets.ts', 'utf8');
  const m = src.match(/XR_AUTH_SECRET:\s*"([^"]+)"/);
  const secret = m ? m[1] : 'xr-dev-secret-change-me';
  const iat = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', secret).update(uid + '.' + iat).digest('hex').slice(0, 40);
  return `v1.${uid}.${iat}.${sig}`;
}

async function liveChat(model) {
  const res = await fetch(LIVE + '/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: 'xr_ds=' + mint(UID) },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Reply with exactly this text and nothing else: PRIME E2E OK' }], model, mode: 'koder' }),
    signal: AbortSignal.timeout(100000),
  });
  return res.json();
}

(async () => {
  const fails = [];
  const ok = (cond, label) => { console.log((cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) fails.push(label); };

  const srv = http.createServer((req, res) => {
    const name = req.url.split('?')[0] === '/' ? FILE : decodeURIComponent(req.url.split('?')[0].slice(1));
    const fp = path.join(ROOT, name);
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp)) { res.writeHead(404); res.end('nope'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(fp)] || 'application/octet-stream' });
    fs.createReadStream(fp).pipe(res);
  });
  await new Promise(r => srv.listen(PORT, r));

  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1360, height: 850 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));

  await p.route('**/api/discord/check', r => r.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, uid: UID, invite: 'https://discord.gg/YPqmsrMRr5', roleId: '111222333444555666', owner: false }),
  }));

  // ---- T1: engine menu (fresh context, default engine) ----
  await p.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load' });
  await p.waitForTimeout(2600);
  const fr = p.mainFrame();
  await fr.click('#homeModelBtn');
  await p.waitForTimeout(350);
  const models = await fr.evaluate(() => Array.from(document.querySelectorAll('#homeModeMenu button[data-model]')).map(x => x.dataset.model));
  ok(JSON.stringify(models) === JSON.stringify(['auto', 'prime-v1', 'prime-v1-flash', 'prime-vision']),
    'T1 engine menu = auto + 3 prime ids: ' + JSON.stringify(models));
  await p.screenshot({ path: '/home/z/my-project/download/preview-prime-menu.png' });

  // ---- T2+T3: wiring + chip/toast (intercepted chat) ----
  const chats = [];
  await p.route('**/api/chat', r => { chats.push(r.request().postDataJSON()); r.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, text: 'WIRING OK', engine: 'xr-code', mode: 'koder' }),
  }); });

  const sel = async (menuBtn, menuId, id) => {
    // JS clicks: state-independent (pill toggles would otherwise depend on the
    // menu already being open/closed from the previous step)
    await fr.evaluate(([mb, mi, i]) => {
      document.querySelector(mb).click();
      document.querySelector(`${mi} button[data-model="${i}"]`).click();
    }, [menuBtn, menuId, id]);
    await p.waitForTimeout(400);
  };
  const chip = () => fr.evaluate(() => (document.getElementById('chatModelChip') || {}).textContent || '');

  await sel('#homeModelBtn', '#homeModeMenu', 'prime-v1');
  await fr.fill('#homeInput', 'ping one');
  await fr.press('#homeInput', 'Enter');
  await p.waitForTimeout(900);
  ok((await chip()) === 'Prime', 'T3a chip after prime-v1: "' + (await chip()) + '"');

  await sel('#chatModelBtn', '#chatModeMenu', 'prime-v1-flash');
  await fr.fill('#chatInput', 'ping two');
  await fr.press('#chatInput', 'Enter');
  await p.waitForTimeout(900);
  ok((await chip()) === 'Prime Flash', 'T3b chip after prime-v1-flash: "' + (await chip()) + '"');

  await sel('#chatModelBtn', '#chatModeMenu', 'prime-vision');
  await fr.fill('#chatInput', 'ping three');
  await fr.press('#chatInput', 'Enter');
  await p.waitForTimeout(900);
  ok((await chip()) === 'Prime Vision', 'T3c chip after prime-vision: "' + (await chip()) + '"');

  const sent = chats.map(c => c.model);
  ok(JSON.stringify(sent) === JSON.stringify(['prime-v1', 'prime-v1-flash', 'prime-vision']),
    'T2 /api/chat bodies carried the right model ids: ' + JSON.stringify(sent));
  const lsModel = await fr.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      try { const v = JSON.parse(localStorage.getItem(k)); if (v && 'model' in v) return v.model; } catch (e) {}
    }
    return null;
  });
  ok(lsModel === 'prime-vision', 'T3d localStorage engine persisted: ' + lsModel);

  // toast text of the last selection
  const toasts = await fr.evaluate(() => Array.from(document.querySelectorAll('.toast, #toasts > *')).map(t => t.textContent).join(' | '));
  ok(/Engine: Prime Vision/.test(toasts), 'T3e toast text: "' + toasts + '"');

  // ---- T4: legacy prime-v1-vision remap ----
  await fr.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      try {
        const v = JSON.parse(localStorage.getItem(k));
        if (v && 'model' in v) { v.model = 'prime-v1-vision'; localStorage.setItem(k, JSON.stringify(v)); return; }
      } catch (e) {}
    }
  });
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(2400);
  const fr2 = p.mainFrame();
  const remapped = await fr2.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      try { const v = JSON.parse(localStorage.getItem(k)); if (v && 'model' in v) return v.model; } catch (e) {}
    }
    return null;
  });
  const chip4 = await fr2.evaluate(() => (document.getElementById('chatModelChip') || {}).textContent || '');
  ok(remapped === 'prime-vision', 'T4a legacy prime-v1-vision remapped in storage: ' + remapped);
  ok(chip4 === 'Prime Vision', 'T4b chip shows remapped engine: "' + chip4 + '"');

  await b.close();
  srv.close();

  // ---- T5: REAL production chain :3000 for all three models ----
  for (const m of ['prime-v1', 'prime-v1-flash', 'prime-vision']) {
    const t0 = Date.now();
    try {
      const j = await liveChat(m);
      const secs = Math.round((Date.now() - t0) / 100) / 10;
      ok(j.ok === true && typeof j.text === 'string' && j.text.length > 0 && !/unavailable|temporarily/i.test(j.text),
        `T5 ${m} live reply in ${secs}s: "` + String(j.text || '').slice(0, 80).replace(/\n/g, ' ') + '"');
    } catch (e) {
      ok(false, 'T5 ' + m + ' live call failed: ' + String(e).slice(0, 120));
    }
  }

  ok(errs.length === 0, 'T6 zero JS errors' + (errs.length ? ' -> ' + errs.join(' ; ').slice(0, 300) : ''));

  console.log(fails.length ? 'RESULT: ' + fails.length + ' FAIL(ures)' : 'RESULT: ALL PASS');
  process.exit(fails.length ? 2 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });

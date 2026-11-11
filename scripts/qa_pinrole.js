// QA: Discord gate owner role-link flow against the PRIVATE (obfuscated) build.
// Serves download/, intercepts /api/discord/* with scripted responses, drives:
//   A) owner verified, role unpinned  -> settings shows .ds-pin; bad id -> error; good id -> toast + box gone
//   B) member hits roleconf           -> lock shows the new Copy-Role-ID copy
//   C) verified member (not owner)    -> no .ds-pin even when role unpinned
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = '/home/z/my-project/download';
const FILE = 'xr-code-private.html';
const PORT = 8123;

const mime = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((req, res) => {
  const name = req.url.split('?')[0] === '/' ? FILE : decodeURIComponent(req.url.split('?')[0].slice(1));
  const fp = path.join(ROOT, name);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp)) { res.writeHead(404); res.end('nope'); return; }
  res.writeHead(200, { 'Content-Type': mime[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});

(async () => {
  await new Promise(r => srv.listen(PORT, r));
  const b = await chromium.launch();
  const fails = [];
  const ok = (cond, label) => { console.log((cond ? 'PASS' : 'FAIL') + '  ' + label); if (!cond) fails.push(label); };

  // ---- scenario A: owner, role unpinned ----
  {
    const p = await b.newPage({ viewport: { width: 1360, height: 850 } });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    let pinCalls = [];
    await p.route('**/api/discord/check', r => r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, uid: '987654321012345678', invite: 'https://discord.gg/YPqmsrMRr5', roleId: null, owner: true }),
    }));
    await p.route('**/api/discord/pinrole', r => {
      const body = r.request().postDataJSON ? r.request().postDataJSON() : {};
      pinCalls.push(body);
      const bad = !/^\d{15,25}$/.test(String(body.roleId || ''));
      r.fulfill({
        status: bad ? 400 : 200, contentType: 'application/json',
        body: JSON.stringify(bad ? { ok: false, error: 'format' } : { ok: true, roleId: '111222333444555666' }),
      });
    });
    await p.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load' });
    await p.waitForTimeout(1400);
    const fr = p.mainFrame();
    const locked = await fr.evaluate(() => { const l = document.getElementById('dsLock'); return l && !l.hidden; });
    ok(!locked, 'A1 verified owner: gate stays open');
    await fr.evaluate(() => { showView('settings'); });
    await p.waitForTimeout(500);
    const hasPin = await fr.evaluate(() => !!document.querySelector('#accBox .ds-pin'));
    ok(hasPin, 'A2 owner box (.ds-pin) visible in Settings');
    const labText = await fr.evaluate(() => { const l = document.querySelector('#accBox .ds-pin-l'); return l ? l.textContent : ''; });
    ok(/Owner step/.test(labText), 'A3 owner box label correct: "' + labText + '"');

    // bad role id -> format error, box stays (atomic step: ensure view + box, fill, click)
    await fr.evaluate(() => { showView('settings'); renderAccounts(); const i = document.querySelector('#accBox .ds-pin-r input'); i.value = '12ab'; document.querySelector('#accBox .ds-pin-b').click(); });
    await p.waitForTimeout(600);
    const msg1 = await fr.evaluate(() => { const m = document.querySelector('#accBox .ds-pin-m'); return m ? m.textContent : ''; });
    ok(/Copy Role ID/.test(msg1), 'A4 bad id -> guidance message: "' + msg1.slice(0, 60) + '..."');
    const stillThere = await fr.evaluate(() => !!document.querySelector('#accBox .ds-pin'));
    ok(stillThere, 'A5 box still present after failed link');

    // good role id -> toast + box disappears
    await fr.evaluate(() => { const i = document.querySelector('#accBox .ds-pin-r input'); i.value = '111222333444555666'; document.querySelector('#accBox .ds-pin-b').click(); });
    await p.waitForTimeout(700);
    const gone = await fr.evaluate(() => !document.querySelector('#accBox .ds-pin'));
    ok(gone, 'A6 after successful link the owner box is gone');
    const toasts = await fr.evaluate(() => Array.from(document.querySelectorAll('.toast, #toasts > *')).map(t => t.textContent).join(' | '));
    ok(/linked/.test(toasts), 'A7 success toast shown: "' + toasts + '"');
    ok(pinCalls.length === 2 && pinCalls[1].roleId === '111222333444555666', 'A8 pinrole payload correct');
    ok(errs.length === 0, 'A9 zero JS errors (owner flow)' + (errs.length ? ' -> ' + errs.join(' ; ') : ''));
    await p.close();
  }

  // ---- scenario B: member hits roleconf ----
  {
    const p = await b.newPage({ viewport: { width: 1360, height: 850 } });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.route('**/api/discord/check', r => r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, error: 'roleconf', invite: 'https://discord.gg/YPqmsrMRr5', roleId: null }),
    }));
    await p.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load' });
    await p.waitForTimeout(1400);
    const fr = p.mainFrame();
    const locked = await fr.evaluate(() => { const l = document.getElementById('dsLock'); return l && !l.hidden; });
    ok(locked, 'B1 unverified member: lock shown');
    const txt = await fr.evaluate(() => { const e = document.getElementById('dsErr'); return e ? e.textContent : ''; });
    ok(/Copy Role ID/.test(txt) && /Settings/.test(txt), 'B2 roleconf copy points owner to Settings + Copy Role ID');
    ok(errs.length === 0, 'B3 zero JS errors (roleconf)' + (errs.length ? ' -> ' + errs.join(' ; ') : ''));
    await p.screenshot({ path: '/tmp/render/qa-lock-roleconf.png' });
    await p.close();
  }

  // ---- scenario C: verified member, not owner, role unpinned ----
  {
    const p = await b.newPage({ viewport: { width: 1360, height: 850 } });
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.route('**/api/discord/check', r => r.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, uid: '111000111000111000', invite: 'https://discord.gg/YPqmsrMRr5', roleId: null, owner: false }),
    }));
    await p.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load' });
    await p.waitForTimeout(1400);
    const fr = p.mainFrame();
    await fr.evaluate(() => { showView('settings'); });
    await p.waitForTimeout(400);
    const noPin = await fr.evaluate(() => !document.querySelector('#accBox .ds-pin'));
    ok(noPin, 'C1 member (not owner): NO owner box');
    ok(errs.length === 0, 'C2 zero JS errors (member view)' + (errs.length ? ' -> ' + errs.join(' ; ') : ''));
    await p.close();
  }

  await b.close();
  srv.close();
  console.log(fails.length ? '\n*** ' + fails.length + ' FAILURE(S) ***' : '\nALL QA CHECKS PASSED');
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('QA crashed:', e); process.exit(2); });

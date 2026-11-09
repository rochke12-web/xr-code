/* probe: all-in-one GLM badge — no prime, no dropdown, chat works */
const { chromium } = require('playwright');

(async () => {
  const results = [];
  const ok = (n, c, extra) => { results.push({ n, ok: !!c, extra: extra || '' }); console.log((c ? 'PASS' : 'FAIL') + ' - ' + n + (extra ? ' | ' + extra : '')); };

  const browser = await chromium.launch();
  const pg = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  pg.on('pageerror', e => errors.push(String(e)));

  await pg.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 45000 });
  await pg.waitForTimeout(1200);
  const frame = pg.frames().find(f => f !== pg.mainFrame());
  if (!frame) { console.log('FAIL - no app frame'); process.exit(1); }

  // 1. badge shows GLM, no menus, no prime anywhere
  const st = await frame.evaluate(() => ({
    homePill: document.querySelector('#homeModelBtn .mp-n')?.textContent,
    chatPill: document.querySelector('#chatModelBtn .mp-n')?.textContent,
    homeMenu: !!document.querySelector('#homeModelMenu'),
    chatMenu: !!document.querySelector('#chatModelMenu'),
    primeText: /prime/i.test(document.body.textContent || ''),
    chevInPill: !!document.querySelector('#homeModelBtn use[href="#i-chevd"]'),
    cpuInPill: !!document.querySelector('#homeModelBtn use[href="#i-cpu"]'),
  }));
  ok('home pill = GLM', st.homePill === 'GLM', String(st.homePill));
  ok('chat pill = GLM', st.chatPill === 'GLM', String(st.chatPill));
  ok('no dropdown menus', !st.homeMenu && !st.chatMenu);
  ok('no prime anywhere', !st.primeText);
  ok('cpu icon in pill', st.cpuInPill);
  ok('no chevron in pill', !st.chevInPill);

  // 2. clicking pill toasts (no menu opens)
  await frame.click('#homeModelBtn');
  await pg.waitForTimeout(400);
  const toastTxt = await frame.evaluate(() => document.querySelector('.toast') ? document.querySelector('.toast').textContent : '');
  ok('pill click → toast', /GLM family/.test(toastTxt), toastTxt.slice(0, 60));

  // 3. e2e chat on the one brain
  await frame.fill('#homeInput', 'Reply with exactly: ONEBRAIN-E2E-7');
  await frame.press('#homeInput', 'Enter');
  let reply = '';
  for (let i = 0; i < 25; i++) {
    await pg.waitForTimeout(2000);
    reply = await frame.evaluate(() => {
      const ms = [...document.querySelectorAll('#msgs .msg.a')];
      return ms.length ? ms[ms.length - 1].textContent.trim() : '';
    });
    if (reply.replace('XR Code', '').trim()) break;
  }
  ok('e2e reply', /ONEBRAIN-E2E-7/.test(reply.replace('XR Code', '')), reply.slice(0, 70));

  await pg.screenshot({ path: 'scripts/preview-27-allinone.png' });
  ok('no pageerror', errors.length === 0, errors.join('; ').slice(0, 120));

  await browser.close();
  const fails = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - fails}/${results.length} passed`);
  process.exit(fails ? 1 : 0);
})();

/* probe: two modes — Koder / QnA picker replaces model badge */
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

  // 1. default pill = Koder, menus exist with exactly 2 modes
  const st0 = await frame.evaluate(() => ({
    home: document.querySelector('#homeModelBtn .mp-n')?.textContent,
    chat: document.querySelector('#chatModelBtn .mp-n')?.textContent,
    nMenus: document.querySelectorAll('#homeModeMenu,#chatModeMenu').length,
    entries: [...document.querySelectorAll('#homeModeMenu button')].map(b => b.querySelector('b').textContent),
    ic: document.querySelector('#homeModelBtn svg.ic use')?.getAttribute('href'),
    chev: !!document.querySelector('#homeModelBtn use[href="#i-chevd"]'),
  }));
  ok('default pill Koder', st0.home === 'Koder' && st0.chat === 'Koder', st0.home + '/' + st0.chat);
  ok('2 mode menus', st0.nMenus === 2);
  ok('entries Koder+QnA', JSON.stringify(st0.entries) === JSON.stringify(['Koder Mode', 'QnA Mode']), st0.entries.join(','));
  ok('koder icon i-cpu', st0.ic === '#i-cpu', st0.ic);
  ok('chevron present', st0.chev);

  // 2. open menu, chevron rotates, screenshot
  await frame.click('#homeModelBtn');
  await pg.waitForTimeout(350);
  const open1 = await frame.evaluate(() => document.querySelector('#homeModeMenu').classList.contains('open'));
  ok('menu opens', open1);
  await pg.screenshot({ path: 'scripts/preview-28-mode-menu.png' });

  // 3. pick QnA → pill, icon, toast, persistence
  await frame.evaluate(() => { [...document.querySelectorAll('#homeModeMenu button')].find(b => b.dataset.mode === 'qna').click(); });
  await pg.waitForTimeout(400);
  const st1 = await frame.evaluate(() => ({
    pill: document.querySelector('#homeModelBtn .mp-n').textContent,
    ic: document.querySelector('#homeModelBtn svg.ic use')?.getAttribute('href'),
    saved: JSON.parse(localStorage.getItem('xr-code-v3') || localStorage.getItem('xrcode-state') || '{}').mode,
  }));
  ok('pill → QnA', st1.pill === 'QnA', st1.pill);
  ok('icon → i-qna', st1.ic === '#i-qna', st1.ic);
  const toastTxt = await frame.evaluate(() => document.querySelector('.toast') ? document.querySelector('.toast').textContent : '');
  ok('toast Mode: QnA', /Mode: ?QnA/.test(toastTxt), toastTxt.slice(0, 40));

  // 4. reload → mode persists
  await pg.reload({ waitUntil: 'networkidle' });
  await pg.waitForTimeout(1200);
  const fr2 = pg.frames().find(f => f !== pg.mainFrame());
  const st2 = await fr2.evaluate(() => document.querySelector('#homeModelBtn .mp-n')?.textContent);
  ok('mode persists after reload', st2 === 'QnA', String(st2));

  // 5. e2e chat on QnA mode
  await fr2.fill('#homeInput', 'what is the speed of light?');
  await fr2.press('#homeInput', 'Enter');
  let reply = '';
  for (let i = 0; i < 30; i++) {
    await pg.waitForTimeout(2000);
    reply = await fr2.evaluate(() => {
      const ms = [...document.querySelectorAll('#msgs .msg.a')];
      return ms.length ? ms[ms.length - 1].textContent.trim() : '';
    }).catch(() => '');
    if (reply.replace('XR Code', '').trim()) break;
  }
  ok('qna e2e reply', /299|light/i.test(reply), reply.replace('XR Code', '').slice(0, 70));

  // 6. switch back to Koder mid-chat
  await fr2.click('#chatModelBtn');
  await pg.waitForTimeout(300);
  await fr2.evaluate(() => { [...document.querySelectorAll('#chatModeMenu button')].find(b => b.dataset.mode === 'koder').click(); });
  await pg.waitForTimeout(300);
  const st3 = await fr2.evaluate(() => document.querySelector('#chatModelBtn .mp-n')?.textContent);
  ok('switch back to Koder', st3 === 'Koder', String(st3));
  await pg.screenshot({ path: 'scripts/preview-29-mode-qna.png' });

  ok('no pageerror', errors.length === 0, errors.join('; ').slice(0, 120));

  await browser.close();
  const fails = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - fails}/${results.length} passed`);
  process.exit(fails ? 1 : 0);
})();

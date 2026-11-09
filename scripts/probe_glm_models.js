/* probe: free GLM models in the picker + e2e chat on a GLM engine */
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

  // 1. menu has 11 engine buttons (2 prime + 9 glm)
  const counts = await frame.evaluate(() => ({
    home: document.querySelectorAll('#homeModelMenu button[data-m]').length,
    chat: document.querySelectorAll('#chatModelMenu button[data-m]').length,
    glmHome: document.querySelectorAll('#homeModelMenu button[data-m^="glm-"]').length,
    labels: [...document.querySelectorAll('#homeModelMenu button[data-m^="glm-"] b')].map(b => b.textContent),
    group: !!document.querySelector('#homeModelMenu .mgl'),
  }));
  ok('home menu 11 engines', counts.home === 11, JSON.stringify(counts.home));
  ok('chat menu 11 engines', counts.chat === 11, JSON.stringify(counts.chat));
  ok('9 GLM entries', counts.glmHome === 9);
  ok('group label present', counts.group);
  ok('GLM labels correct', JSON.stringify(counts.labels) === JSON.stringify(['GLM 4.6','GLM 4.6V','GLM 4.5','GLM 4.5 Air','GLM 4.5 Flash','GLM 4.5V','GLM 4 Plus','GLM 4 Flash','GLM 4V Flash']), counts.labels.join(','));

  // 2. open menu, screenshot
  await frame.click('#homeModelBtn');
  await pg.waitForTimeout(350);
  const menuOpen = await frame.evaluate(() => document.querySelector('#homeModelMenu').classList.contains('open'));
  ok('menu opens', menuOpen);
  await pg.screenshot({ path: 'scripts/preview-25-glm-menu.png' });

  // 3. pick GLM 4.6 → pill label updates
  await frame.evaluate(() => { [...document.querySelectorAll('#homeModelMenu button')].find(b => b.dataset.m === 'glm-4.6').click(); });
  await pg.waitForTimeout(300);
  const pill = await frame.evaluate(() => document.querySelector('#homeModelBtn .mp-n').textContent);
  ok('pill shows GLM 4.6', pill === 'GLM 4.6', pill);

  // 4. e2e chat on GLM 4.6
  await frame.fill('#homeInput', 'Reply with exactly: XRCODE-GLM-E2E-42');
  await frame.press('#homeInput', 'Enter');
  let reply = '';
  for (let i = 0; i < 30; i++) {
    await pg.waitForTimeout(2000);
    reply = await frame.evaluate(() => {
      const ms = [...document.querySelectorAll('#msgs .msg.a')];
      return ms.length ? ms[ms.length - 1].textContent.trim() : '';
    });
    if (reply && reply.replace('XR Code', '').trim()) break;
  }
  ok('e2e GLM reply', /XRCODE-GLM-E2E-42/.test(reply.replace('XR Code', '')), reply.slice(0, 80));
  await pg.screenshot({ path: 'scripts/preview-26-glm-chat.png' });

  // 5. switch to GLM 4.5 Flash mid-chat via chat menu
  await frame.click('#chatModelBtn');
  await pg.waitForTimeout(300);
  await frame.evaluate(() => { [...document.querySelectorAll('#chatModelMenu button')].find(b => b.dataset.m === 'glm-4.5-flash').click(); });
  await pg.waitForTimeout(250);
  const pill2 = await frame.evaluate(() => document.querySelector('#chatModelBtn .mp-n') ? document.querySelector('#chatModelBtn .mp-n').textContent : document.querySelector('#homeModelBtn .mp-n').textContent);
  ok('chat pill GLM 4.5 Flash', /GLM 4\.5 Flash/.test(pill2), pill2);

  ok('no pageerror', errors.length === 0, errors.join('; ').slice(0, 120));

  await browser.close();
  const fails = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - fails}/${results.length} passed`);
  process.exit(fails ? 1 : 0);
})();

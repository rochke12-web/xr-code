/* probe: Sight Mode — 3 modes in picker, Sight pill with eye icon, visual-by-default image gen */
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

  // 1. both menus now have 3 modes: Koder, QnA, Sight
  const st = await frame.evaluate(() => ({
    home: [...document.querySelectorAll('#homeModeMenu button')].map(b => b.dataset.mode),
    chat: [...document.querySelectorAll('#chatModeMenu button')].map(b => b.dataset.mode),
    sightSmall: document.querySelector('#homeModeMenu button[data-mode="sight"] small')?.textContent.trim(),
  }));
  ok('home menu has 3 modes', JSON.stringify(st.home) === JSON.stringify(['koder', 'qna', 'sight']), st.home.join(','));
  ok('chat menu has 3 modes', JSON.stringify(st.chat) === JSON.stringify(['koder', 'qna', 'sight']), st.chat.join(','));
  ok('Sight description ok', st.sightSmall === 'photo & video AI — imagine it, see it', st.sightSmall);

  // 2. open menu, screenshot, pick Sight
  await frame.click('#homeModelBtn');
  await pg.waitForTimeout(400);
  await pg.screenshot({ path: 'scripts/preview-33-sight-menu.png' });
  await frame.click('#homeModeMenu button[data-mode="sight"]');
  await pg.waitForTimeout(350);
  const pill = await frame.evaluate(() => ({
    n: document.querySelector('#homeModelBtn .mp-n')?.textContent,
    ic: document.querySelector('#homeModelBtn svg.ic use')?.getAttribute('href'),
  }));
  ok('pill = Sight', pill.n === 'Sight', pill.n);
  ok('pill icon = eye', pill.ic === '#i-eye', pill.ic);

  // 3. Sight visual-by-default: no "generate" word, just a scene description
  await frame.fill('#homeInput', 'a neon city in the rain at night');
  await frame.click('#homeForm .send-btn');
  await frame.waitForSelector('#chatInput', { timeout: 15000 });
  console.log('sent scene description, waiting for Sight to create (up to 170s)...');
  let imgOk = false;
  try {
    await frame.waitForSelector('.msg.a img[src*="/api/asset/"]', { timeout: 170000 });
    imgOk = true;
  } catch { imgOk = false; }
  const reply = await frame.evaluate(() => [...document.querySelectorAll('.msg.a .bubble')].map(b => b.textContent.trim()).pop() || '');
  ok('Sight created a photo without the word generate', imgOk);
  ok('no raw action JSON leaked', !/\{"action"\s*:/.test(reply), reply.slice(0, 90));
  await pg.screenshot({ path: 'scripts/preview-34-sight-image.png' });

  ok('no page errors', errors.length === 0, errors.join('; ').slice(0, 160));
  await browser.close();
  const fails = results.filter(r => !r.ok).length;
  console.log(fails === 0 ? 'ALL PASS (' + results.length + ')' : fails + ' FAILURES');
  process.exit(fails === 0 ? 0 : 1);
})();

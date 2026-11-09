/* probe: QnA menu block — "answers from the web" removed from both mode menus */
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

  // 1. both menus: QnA small text = "sources never shown", no "answers from the web" anywhere
  const st = await frame.evaluate(() => {
    const grab = sel => [...document.querySelectorAll(sel + ' button[data-mode="qna"] small')].map(s => s.textContent.trim());
    return {
      home: grab('#homeModeMenu'),
      chat: grab('#chatModeMenu'),
      bodyHasPhrase: document.body.textContent.includes('answers from the web'),
      koderSmall: document.querySelector('#homeModeMenu button[data-mode="koder"] small')?.textContent.trim(),
    };
  });
  ok('home QnA small = "sources never shown"', st.home[0] === 'sources never shown', st.home[0]);
  ok('chat QnA small = "sources never shown"', st.chat[0] === 'sources never shown', st.chat[0]);
  ok('phrase "answers from the web" gone', st.bodyHasPhrase === false);
  ok('Koder description untouched', st.koderSmall === 'code, debug & build — the full developer brain', st.koderSmall);

  // 2. open home menu → visual check
  await frame.click('#homeModelBtn');
  await pg.waitForTimeout(400);
  await pg.screenshot({ path: 'scripts/preview-30-qna-menu-clean.png' });

  // 3. switch to QnA still works, pill updates
  await frame.click('#homeModeMenu button[data-mode="qna"]');
  await pg.waitForTimeout(350);
  const pill = await frame.evaluate(() => document.querySelector('#homeModelBtn .mp-n')?.textContent);
  ok('QnA still selectable', pill === 'QnA', pill);

  // restore koder default for clean state
  await frame.click('#homeModelBtn');
  await pg.waitForTimeout(250);
  await frame.click('#homeModeMenu button[data-mode="koder"]').catch(() => {});
  await pg.waitForTimeout(250);

  ok('no page errors', errors.length === 0, errors.join('; ').slice(0, 200));
  await browser.close();
  const fails = results.filter(r => !r.ok).length;
  console.log(fails === 0 ? 'ALL PASS (' + results.length + ')' : fails + ' FAILURES');
  process.exit(fails === 0 ? 0 : 1);
})();

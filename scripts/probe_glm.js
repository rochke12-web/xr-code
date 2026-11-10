// GLM models probe: menu group, selection, chat e2e with a free GLM
const { chromium } = require('playwright');
const URL = 'http://localhost:3000/';
let pass = 0, fail = 0;
const ok = (c, l) => { console.log((c ? 'PASS ' : 'FAIL ') + l); c ? pass++ : fail++; };

(async () => {
  const browser = await chromium.launch();
  const pg = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  pg.on('pageerror', e => errors.push(String(e)));
  await pg.goto(URL, { waitUntil: 'networkidle', timeout: 45000 });
  const fr = pg.frames().find(f => f !== pg.mainFrame()) || pg.mainFrame();

  // menu contents
  await fr.click('#homeModelBtn');
  await pg.waitForTimeout(400);
  const menu = await fr.evaluate(() => {
    const m = document.querySelector('#homeModelMenu');
    const items = [...m.querySelectorAll('button')].map(b => b.dataset.m);
    const sep = m.querySelector('.mm-sep')?.textContent || '';
    return { items, sep, open: m.classList.contains('open') };
  });
  ok(menu.open, 'model menu opens');
  ok(menu.sep === 'Free GLMs', 'group label present (' + menu.sep + ')');
  const want = ['prime-v1-flash', 'prime-v1-vision', 'glm-4.5-flash', 'glm-4-flash', 'glm-4-32b-flash', 'glm-4.5v'];
  ok(JSON.stringify(menu.items) === JSON.stringify(want), '6 models in order (' + menu.items.join(',') + ')');
  await pg.screenshot({ path: 'download/preview-25-glm-menu.png' });

  // pick GLM 4.5 Flash
  await fr.click('#homeModelMenu button[data-m="glm-4.5-flash"]');
  await pg.waitForTimeout(300);
  const pill = await fr.evaluate(() => document.querySelector('#homeModelBtn .mp-n')?.textContent);
  ok(pill === 'GLM Flash', 'pill shows GLM Flash (' + pill + ')');

  // chat e2e on the GLM engine
  await fr.fill('#homeInput', 'In one short sentence, what is 17 * 23?');
  await fr.click('#homeForm .send-btn');
  try {
    await pg.waitForFunction(() => {
      const b = [...document.querySelectorAll('.msg.a .bubble')];
      return b.length && !document.querySelector('.dots');
    }, { timeout: 90000 });
  } catch (e) {}
  await pg.waitForTimeout(1200);
  const reply = await fr.evaluate(() => {
    const b = [...document.querySelectorAll('.msg.a .bubble')];
    return b.length ? b[b.length - 1].textContent : '';
  });
  ok(/391/.test(reply), 'GLM chat reply correct (' + reply.slice(0, 80) + ')');
  const chip = await fr.evaluate(() => document.querySelector('#chatModelChip')?.textContent);
  ok(chip === 'online', 'status chip online (' + chip + ')');
  await pg.screenshot({ path: 'download/preview-26-glm-chat.png' });

  ok(errors.length === 0, 'no page errors (' + errors.join('; ').slice(0, 100) + ')');
  console.log(`\n${pass} pass, ${fail} fail`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();

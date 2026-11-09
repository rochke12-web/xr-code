/* debug: send on GLM 4.6 and dump chat DOM + api status */
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const pg = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const reqs = [];
  pg.on('response', async r => { if (r.url().includes('/api/chat')) reqs.push({ s: r.status(), u: r.url() }); });
  await pg.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 45000 });
  await pg.waitForTimeout(1200);
  const frame = pg.frames().find(f => f !== pg.mainFrame());
  await frame.evaluate(() => { [...document.querySelectorAll('#homeModelMenu button')].find(b => b.dataset.m === 'glm-4.6')?.click(); });
  await frame.click('#homeModelBtn'); await pg.waitForTimeout(200);
  await frame.evaluate(() => { [...document.querySelectorAll('#homeModelMenu button')].find(b => b.dataset.m === 'glm-4.6').click(); });
  await pg.waitForTimeout(200);
  await frame.fill('#homeInput', 'Reply with exactly: DEBUG-GLM-77');
  await pg.waitForTimeout(150);
  const pill = await frame.evaluate(() => document.querySelector('#homeModelBtn .mp-n').textContent);
  console.log('pill before send:', pill);
  await frame.press('#homeInput', 'Enter');
  for (let i = 0; i < 20; i++) {
    await pg.waitForTimeout(2000);
    const state = await frame.evaluate(() => {
      const ms = [...document.querySelectorAll('#msgs .msg')];
      const last = ms[ms.length - 1];
      return {
        nMsgs: ms.length,
        classes: ms.map(m => m.className).join(' | ').slice(0, 150),
        lastText: last ? last.textContent.trim().slice(0, 200) : '',
        view: document.querySelector('.view.open') ? document.querySelector('.view.open').id : '?',
      };
    });
    console.log(i, JSON.stringify(state));
    if (state.nMsgs >= 2 && state.lastText && state.classes.includes('ai')) break;
  }
  console.log('api responses:', JSON.stringify(reqs));
  await browser.close();
})();

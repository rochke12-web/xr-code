const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function appFrame(pg) {
  for (let i = 0; i < 10; i++) { const f = pg.frames().find(f => f !== pg.mainFrame()); if (f) return f; await sleep(300); }
  return null;
}
(async () => {
  const browser = await chromium.launch();
  const pg = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await pg.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await sleep(1200);
  const frame = await appFrame(pg);
  // 1. settings view opens
  await frame.click('#btnSettings');
  await sleep(900);
  const s = await frame.evaluate(() => ({
    active: document.querySelector('#view-settings')?.classList.contains('active'),
    hasContent: (document.querySelector('#view-settings')?.innerText || '').length > 50,
  }));
  console.log('settings view opens:', s.active && s.hasContent ? 'PASS' : 'FAIL', JSON.stringify(s));
  await pg.screenshot({ path: 'scripts/night-settings.png' });
  // 2. theme quick toggle: dark -> light -> dark
  await frame.click('#btnHome');
  await sleep(600);
  const t = await frame.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const root = document.documentElement;
    const bg = () => getComputedStyle(document.body).backgroundColor;
    const before = { theme: root.dataset.theme, bg: bg() };
    const btn = document.querySelector('.theme-quick');
    btn.click(); await sleep(700);
    const mid = { theme: root.dataset.theme, bg: bg() };
    btn.click(); await sleep(700);
    const end = { theme: root.dataset.theme, bg: bg() };
    return { before, mid, end };
  });
  const themeOk = t.before.theme === 'dark' && t.mid.theme === 'light' && t.end.theme === 'dark' && t.before.bg !== t.mid.bg;
  console.log('theme toggle dark<->light:', themeOk ? 'PASS' : 'FAIL', JSON.stringify(t));
  // 3. persistence of chosen theme after reload
  await frame.evaluate(() => { document.querySelector('.theme-quick').click(); });
  await sleep(700);
  await pg.reload({ waitUntil: 'networkidle' }).catch(() => {});
  await sleep(1500);
  const f2 = await appFrame(pg);
  const persist = await f2.evaluate(() => ({ theme: document.documentElement.dataset.theme, saved: localStorage.getItem('xrcode.theme') || localStorage.getItem('xrcode.v1.theme') || 'in-state' }));
  console.log('theme after reload:', JSON.stringify(persist));
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });

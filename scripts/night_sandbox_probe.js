const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const pg = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await pg.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await pg.waitForTimeout(1200);
  const frame = pg.frames().find(f => f !== pg.mainFrame());
  if (!frame) { console.log('FAIL - no app frame'); process.exit(1); }
  await frame.evaluate(() => openSandbox('console.log("HELLO-42"); console.log({a:1});', 'js'));
  await pg.waitForTimeout(900);
  await pg.screenshot({ path: 'scripts/night-sandbox-js.png' });
  await frame.evaluate(() => openSandbox('<h1 style="color:orange">SVG-HTML-OK</h1>', 'html'));
  await pg.waitForTimeout(700);
  await pg.screenshot({ path: 'scripts/night-sandbox-html.png' });
  console.log('screenshots taken');
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });

const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1360, height: 850 } });
  // reload and catch the entrance animation mid-flight
  await p.goto('http://localhost:3000', { waitUntil: 'commit' });
  await p.waitForTimeout(450);
  await p.screenshot({ path: '/tmp/render/ui-entrance.png' });
  await p.waitForTimeout(1400);
  await p.screenshot({ path: '/tmp/render/ui-home-dark.png' });
  const fr = p.frames().find(f => f !== p.mainFrame());

  // chat view
  await fr.evaluate(() => { try { showView('chat'); } catch(e) { document.querySelector('#btnSearch, [id^=btn]'); } });
  await p.waitForTimeout(600);
  await p.screenshot({ path: '/tmp/render/ui-chat.png' });

  // settings view
  await fr.evaluate(() => showView('settings'));
  await p.waitForTimeout(600);
  await p.screenshot({ path: '/tmp/render/ui-settings.png' });

  // light theme home
  await fr.evaluate(() => showView('home'));
  await p.waitForTimeout(300);
  await fr.evaluate(() => document.getElementById('themeQuick').click());
  await p.waitForTimeout(900);
  await p.screenshot({ path: '/tmp/render/ui-home-light.png' });

  // mobile width, dark
  const m = await b.newPage({ viewport: { width: 390, height: 780 } });
  await m.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await m.waitForTimeout(1200);
  await m.screenshot({ path: '/tmp/render/ui-mobile.png' });
  await b.close();
  console.log('ui sweep done');
})();

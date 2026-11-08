const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await p.waitForTimeout(2500);
  const fr = p.frames().find(f => f !== p.mainFrame());
  if (!fr) throw new Error('no iframe');

  const state = async () => fr.evaluate(() => {
    const g = document.querySelector('.nav-glider');
    const cur = document.querySelector('.nav button.current');
    const view = document.querySelector('.view.active');
    return {
      glider: !!g,
      tf: g ? getComputedStyle(g).transform : null,
      op: g ? getComputedStyle(g).opacity : null,
      curId: cur ? cur.id : null,
      view: view ? view.id : null,
      slide: view ? (view.className.match(/slide-\w+/) || [null])[0] : null,
    };
  });

  console.log('boot     :', JSON.stringify(await state()));

  // click Settings -> pill should glide down, view slides fwd
  await fr.evaluate(() => document.getElementById('btnSettings').click());
  await p.waitForTimeout(120); // mid-animation
  const mid = await state();
  console.log('mid      :', JSON.stringify(mid));
  await p.screenshot({ path: '/tmp/render/tab-mid.png', clip: { x: 1040, y: 40, width: 400, height: 500 } });
  await p.waitForTimeout(600);
  console.log('settled  :', JSON.stringify(await state()));
  await p.screenshot({ path: '/tmp/render/tab-settings.png', clip: { x: 1040, y: 40, width: 400, height: 500 } });

  // back to Home -> reverse slide
  await fr.evaluate(() => document.getElementById('btnHome').click());
  await p.waitForTimeout(60);
  console.log('back-mid :', JSON.stringify(await state()));
  await p.waitForTimeout(600);
  console.log('back     :', JSON.stringify(await state()));

  // search toggle -> pill jumps to Search tab
  await fr.evaluate(() => document.getElementById('btnSearch').click());
  await p.waitForTimeout(500);
  console.log('search   :', JSON.stringify(await state()));
  await fr.evaluate(() => document.getElementById('btnSearch').click()); // close again
  await p.waitForTimeout(500);
  console.log('closed   :', JSON.stringify(await state()));

  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });

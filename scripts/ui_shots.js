// ui_shots.js — triple-platform screenshots with reaper-resistant retries
const { chromium, devices } = require('playwright');
const { execSync } = require('child_process');

async function alive() {
  try {
    const r = await fetch('http://localhost:3000/', { signal: AbortSignal.timeout(5000) });
    return r.status === 200;
  } catch { return false; }
}

async function shotOnce(b, dev, vp, name) {
  const pg = await b.newPage({ ...dev, viewport: vp });
  try {
    await pg.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await pg.waitForTimeout(2500);
    const fr = pg.frames().find(f => f !== pg.mainFrame());
    if (fr) await fr.waitForSelector('#homeInput', { timeout: 10000 }).catch(() => {});
    await pg.waitForTimeout(700);
    const ok = await pg.evaluate(() => document.querySelectorAll('iframe').length > 0 && (document.querySelector('iframe')?.getAttribute('srcdoc') || '').length > 1000);
    if (!ok) { await pg.close(); return false; }
    await pg.screenshot({ path: 'download/' + name });
    await pg.close();
    return true;
  } catch { await pg.close().catch(() => {}); return false; }
}

async function restartServer() {
  try { execSync('pkill -f "standalone/server.js"', { stdio: 'ignore' }); } catch {}
  await new Promise(r => setTimeout(r, 2000));
  execSync('cd /home/z/my-project && setsid nohup npm start > /tmp/prod.log 2>&1 < /dev/null & sleep 12', { shell: '/bin/bash' });
  for (let i = 0; i < 6; i++) {
    if (await alive()) return true;
    await new Promise(r => setTimeout(r, 3000));
  }
  return false;
}

(async () => {
  const b = await chromium.launch();
  const jobs = [
    [devices['iPhone 14 Pro'], { width: 393, height: 852 }, 'ui-ios-home.png'],
    [devices['Pixel 7'], { width: 412, height: 915 }, 'ui-android-home.png'],
    [{}, { width: 1440, height: 900 }, 'ui-pc-home.png'],
  ];
  for (const [dev, vp, name] of jobs) {
    let done = false;
    for (let attempt = 1; attempt <= 4 && !done; attempt++) {
      if (!(await alive())) {
        console.log('server dead — restarting (attempt', attempt + ')');
        if (!(await restartServer())) { console.log('restart failed'); continue; }
      }
      done = await shotOnce(b, dev, vp, name);
      console.log(name, done ? 'OK' : 'retry');
      if (!done) await new Promise(r => setTimeout(r, 2000));
    }
  }
  await b.close();
})();

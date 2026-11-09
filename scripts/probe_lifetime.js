/* probe: lifetime fix — kill server mid-chat, revive at t+10s, message must self-heal
   Expected: retry net catches it (chip "busy · retrying…"), NO offline bubble, real reply lands */
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const http = require('http');

const health = () => new Promise(res => {
  http.get('http://localhost:3000/api/health', r => res(r.statusCode === 200)).on('error', () => res(false));
});
const waitUp = async () => { for (let i = 0; i < 20; i++) { if (await health()) return true; await new Promise(r => setTimeout(r, 1000)); } return false; };

(async () => {
  const results = [];
  const ok = (n, c, extra) => { results.push({ n, ok: !!c }); console.log((c ? 'PASS' : 'FAIL') + ' - ' + n + (extra ? ' | ' + extra : '')); };
  const sh = c => { try { execSync(c, { stdio: 'pipe' }); } catch (e) { /* pkill no-match is fine */ } };

  // 0. make sure the server is up before loading the page
  if (!(await health())) {
    sh('cd /home/z/my-project && setsid nohup npm start > /tmp/prod.log 2>&1 < /dev/null &');
    if (!(await waitUp())) { console.log('FAIL - could not start server'); process.exit(1); }
  }

  const browser = await chromium.launch();
  const pg = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  pg.on('pageerror', e => errors.push(String(e)));

  // 1. load app while server is up
  await pg.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 45000 });
  await pg.waitForTimeout(1200);
  const frame = pg.frames().find(f => f !== pg.mainFrame());
  if (!frame) { console.log('FAIL - no app frame'); process.exit(1); }

  // 2. kill the server, then immediately send a message
  sh('pkill -f "standalone/[s]erver.js" || true');   // [s] trick — never match our own command line
  await pg.waitForTimeout(500);
  await frame.fill('#homeInput', 'say the word survivor');
  await frame.click('#homeForm .send-btn');
  await frame.waitForSelector('#chatInput', { timeout: 15000 }).catch(() => {});
  console.log('server killed, message sent — reviving at t+10s...');

  // 3. revive while the client is inside its retry window
  await pg.waitForTimeout(10000);
  sh('cd /home/z/my-project && setsid nohup npm start > /tmp/prod.log 2>&1 < /dev/null &');
  console.log('server reviving...');

  // 4. the reply must land by itself, with NO offline bubble
  let healed = false, offlineShown = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 90000) {
    const st = await frame.evaluate(() => ({
      offline: !!document.querySelector('.msg.a .retry-btn'),
      reply: [...document.querySelectorAll('.msg.a .bubble')].map(b => b.textContent.trim()).pop() || '',
      chip: document.getElementById('chatModelChip')?.textContent || '',
    })).catch(() => null);
    if (st) {
      if (st.offline) { offlineShown = true; break; }
      if (/survivor/i.test(st.reply)) { healed = true; break; }
    }
    await pg.waitForTimeout(2000);
  }
  ok('message auto-healed and answered after outage', healed);
  ok('no offline bubble ever appeared', !offlineShown);
  await pg.screenshot({ path: 'scripts/preview-35-lifetime.png' });

  ok('no page errors', errors.length === 0, errors.join('; ').slice(0, 160));
  await browser.close();
  const fails = results.filter(r => !r.ok).length;
  console.log(fails === 0 ? 'ALL PASS (' + results.length + ')' : fails + ' FAILURES');
  process.exit(fails === 0 ? 0 : 1);
})();

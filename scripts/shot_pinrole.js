// Visual shots of the new owner role-link UI (dark + light) and the roleconf lock
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = '/home/z/my-project/download';
const srv = http.createServer((req, res) => {
  const n = req.url === '/' ? 'xr-code-private.html' : req.url.slice(1);
  const fp = path.join(ROOT, n);
  if (!fs.existsSync(fp)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  fs.createReadStream(fp).pipe(res);
});
(async () => {
  await new Promise(r => srv.listen(8125, r));
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1360, height: 850 } });
  await p.route('**/api/discord/check', r => r.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, uid: '987654321012345678', invite: 'https://discord.gg/YPqmsrMRr5', roleId: null, owner: true }),
  }));
  await p.goto('http://localhost:8125/xr-code-private.html', { waitUntil: 'load' });
  await p.waitForTimeout(1600);
  await p.evaluate(() => { showView('settings'); });
  await p.waitForTimeout(600);
  await p.evaluate(() => { const box = document.getElementById('accBox'); box.scrollIntoView({ block: 'center' }); });
  await p.waitForTimeout(400);
  await p.screenshot({ path: '/tmp/render/qa-owner-box-dark.png' });
  await p.evaluate(() => { document.documentElement.setAttribute('data-theme', 'light'); });
  await p.waitForTimeout(900);
  await p.screenshot({ path: '/tmp/render/qa-owner-box-light.png' });
  await b.close(); srv.close();
  console.log('shots done');
})();

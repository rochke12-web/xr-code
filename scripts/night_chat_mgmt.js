const { chromium } = require('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function appFrame(pg) {
  for (let i = 0; i < 10; i++) {
    const f = pg.frames().find(f => f !== pg.mainFrame());
    if (f) return f;
    await sleep(300);
  }
  return null;
}
(async () => {
  const browser = await chromium.launch();
  const pg = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await pg.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await sleep(1200);
  let frame = await appFrame(pg);
  const before = await frame.evaluate(() => (JSON.parse(localStorage.getItem('xrcode.v1') || '{"chats":[]}').chats.length));
  await frame.fill('#homeInput', 'reply with just: ok');
  await frame.press('#homeInput', 'Enter');
  await sleep(8000);
  frame = await appFrame(pg);
  if (!frame) { console.log('FAIL - frame gone after send'); process.exit(1); }
  const mid = await frame.evaluate(() => {
    const S = JSON.parse(localStorage.getItem('xrcode.v1') || '{"chats":[]}');
    return { count: S.chats.length, msgs: S.chats[0] ? S.chats[0].messages.length : 0 };
  });
  await pg.reload({ waitUntil: 'networkidle' }).catch(() => {});
  await sleep(1500);
  frame = await appFrame(pg);
  const after = await frame.evaluate(() => {
    const S = JSON.parse(localStorage.getItem('xrcode.v1') || '{"chats":[]}');
    return { count: S.chats.length, msgs: S.chats[0] ? S.chats[0].messages.length : 0, listShown: !!document.querySelector('#chatList') };
  });
  console.log('before:', before, '| after send:', JSON.stringify(mid), '| after reload:', JSON.stringify(after));
  const pass = mid.count === before + 1 && mid.msgs >= 2 && after.count === mid.count && after.msgs === mid.msgs;
  console.log(pass ? 'CHAT-MGMT PASS' : 'CHAT-MGMT CHECK');
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });

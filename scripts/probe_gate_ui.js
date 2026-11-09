// UI probe for the Discord lock — unverified visitor sees the gate,
// cannot send, and the gate copy reacts to the owner-setup state.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const br = await chromium.launch();
const pg = await br.newPage({ viewport: { width: 1280, height: 860 } });

await pg.goto(BASE + "/", { waitUntil: "networkidle" });
await pg.waitForTimeout(1200);
const fr = pg.frames().find(f => f !== pg.mainFrame());
const F = fr || pg;

// 1 — lock overlay visible on load?
const gateVisible = await F.evaluate(() => {
  const g = document.querySelector('#gate');
  return g ? getComputedStyle(g).display : 'missing';
});
console.log("gate overlay display:", gateVisible, gateVisible === 'flex' ? "PASS" : "FAIL");

// 2 — gate copy + verify button present
const gateTxt = await F.evaluate(() => {
  const m = document.querySelector('#gateMsg');
  const b = document.querySelector('#gateBtn');
  return { msg: m ? m.textContent.slice(0, 80) : null, btn: b ? b.textContent.trim() : null };
});
console.log("gate msg:", JSON.stringify(gateTxt.msg));
console.log("gate btn:", JSON.stringify(gateTxt.btn));
console.log("gate card:", gateTxt.msg && gateTxt.btn ? "PASS" : "FAIL");

// 3 — the lock must physically block input (overlay intercepts clicks)
let blocked = false;
try { await F.click('#homeInput', { timeout: 1500 }); }
catch (e) { blocked = /intercept|gate/i.test(String(e)); }
console.log("lock blocks input clicks:", blocked ? "PASS" : "FAIL");
const msgCount = await F.evaluate(() => document.querySelectorAll('.msg').length);
console.log("messages while locked:", msgCount, msgCount === 0 ? "PASS" : "FAIL");

// screenshot: lock over home
await pg.screenshot({ path: 'download/preview-16-gate-lock.png' });

// 4 — dserr=setup bounce copy (what the owner sees before pasting the secret)
await pg.goto(BASE + "/?dserr=setup", { waitUntil: "networkidle" });
await pg.waitForTimeout(1200);
const fr2 = pg.frames().find(f => f !== pg.mainFrame());
const F2 = fr2 || pg;
const setupTxt = await F2.evaluate(() => (document.querySelector('#gateMsg') || {}).textContent || '');
console.log("dserr=setup copy:", JSON.stringify(setupTxt.slice(0, 110)));
console.log("setup copy:", setupTxt.includes('owner needs to add the Discord secret') ? "PASS" : "FAIL");

// screenshot: setup-needed copy
await pg.screenshot({ path: 'download/preview-17-gate-setup.png' });

await br.close();
console.log("UI GATE PROBE DONE");

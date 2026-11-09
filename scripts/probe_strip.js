// Post-strip probe — Discord OAuth fully removed.
// API:  POST /api/chat with NO cookie -> 200 real reply (gate is gone)
//       GET /auth/discord / callback / setup -> 404 (routes deleted)
//       POST /api/discord/check -> 404
// UI:   no #gate element, no gate copy anywhere, send works end-to-end, no console errors
const BASE = "http://localhost:3000";
let fails = 0;
function chk(name, got, want) {
  const ok = got === want;
  if (!ok) fails++;
  console.log((ok ? "PASS" : "FAIL") + " | " + name + "  got=" + JSON.stringify(got) + (want !== undefined ? " want=" + JSON.stringify(want) : ""));
}

let r = await fetch(BASE + "/api/chat", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ messages: [{ role: "user", content: "reply with the single word OPEN" }] }),
});
chk("chat without cookie status", r.status, 200);
const j = await r.json().catch(() => ({}));
console.log("       reply:", String(j.text || j.error || "").slice(0, 80));
chk("chat ok flag", String(j.ok), "true");
chk("reply non-empty", (j.text || "").length > 0 ? "yes" : "no", "yes");

for (const p of ["/auth/discord", "/auth/discord/callback", "/auth/discord/setup", "/api/discord/check", "/api/discord/logout", "/api/discord/handoff"]) {
  r = await fetch(BASE + p, { redirect: "manual" });
  chk("deleted route " + p, r.status, 404);
}

import { chromium } from "playwright";
const br = await chromium.launch();
const pg = await br.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
pg.on("pageerror", e => errors.push(String(e)));
await pg.goto(BASE + "/", { waitUntil: "networkidle" });
await pg.waitForTimeout(1500);
const fr = pg.frames().find(f => f !== pg.mainFrame());
const F = fr || pg;

const gateGone = await F.evaluate(() => !document.querySelector('#gate') && !document.querySelector('#gateBtn') && !document.querySelector('#gmBox'));
chk("no gate elements in DOM", gateGone, true);
const bodyTxt = await F.evaluate(() => document.body.innerText);
chk("no discord copy on page", /discord/i.test(bodyTxt) ? "yes" : "no", "no");

// send a real message — must flow with no lock
await F.fill('#homeInput', 'reply with the single word OPEN');
await F.click('#homeForm .send-btn');
await pg.waitForTimeout(12000);
const got = await F.evaluate(() => {
  const as = [...document.querySelectorAll('.msg.a .bubble')];
  return as.length ? as[as.length - 1].textContent.trim() : '';
});
console.log("       chat reply:", JSON.stringify(got.slice(0, 60)));
chk("chat works unlocked", got.length > 0 ? "yes" : "no", "yes");
chk("no page errors", errors.length, 0);
if (errors.length) console.log("       errors:", errors.slice(0, 3));

await pg.screenshot({ path: 'download/preview-19-noauth-home.png' });
await br.close();
console.log(fails === 0 ? "STRIP PROBE: ALL PASS" : `STRIP PROBE: ${fails} FAIL`);
process.exit(fails ? 1 : 0);

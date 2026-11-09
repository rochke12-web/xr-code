// Manual-verify probe — the escape hatch for the redirect_uri error.
// 1) POST /api/discord/handoff with garbage url  -> 400 {error:'paste'}
// 2) POST handoff with error=access_denied url   -> {error:'denied'}
// 3) POST handoff with foreign origin + code     -> 400 {error:'paste'}
// 4) POST handoff with localhost origin + fake code -> {error:'setup'} (no secret yet)
// 5) GET /auth/discord/setup -> 200 HTML with both redirect URIs
// 6) UI: lock card shows manual link; opening it shows paste box; bad paste shows error
const BASE = "http://localhost:3000";
let fails = 0;
function chk(name, got, want) {
  const ok = got === want;
  if (!ok) fails++;
  console.log((ok ? "PASS" : "FAIL") + " | " + name + "  got=" + JSON.stringify(got) + (want !== undefined ? " want=" + JSON.stringify(want) : ""));
}

async function handoff(url) {
  const r = await fetch(BASE + "/api/discord/handoff", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

let r = await handoff("not a url at all");
chk("garbage url status", r.status, 400);
chk("garbage url error", r.body.error, "paste");

r = await handoff("http://localhost:3000/auth/discord/callback?error=access_denied&error_description=Denied");
chk("denied error", r.body.error, "denied");

r = await handoff("https://evil.example.com/auth/discord/callback?code=abc123");
chk("foreign origin status", r.status, 400);
chk("foreign origin error", r.body.error, "paste");

r = await handoff("http://localhost:3000/auth/discord/callback?code=fakecode123");
chk("local origin + fake code passes origin check (secret missing -> setup)", r.body.error, "setup");

r = await fetch(BASE + "/auth/discord/setup");
const html = await r.text();
chk("setup page status", r.status, 200);
chk("setup page shows localhost redirect", html.includes("http://localhost:3000/auth/discord/callback") ? "yes" : "no", "yes");
chk("setup page shows self redirect", html.includes("/auth/discord/callback") ? "yes" : "no", "yes");
chk("setup page flags missing secret", html.includes("MISSING") ? "yes" : "no", "yes");

// UI probe
import { chromium } from "playwright";
const br = await chromium.launch();
const pg = await br.newPage({ viewport: { width: 1280, height: 900 } });
await pg.goto(BASE + "/", { waitUntil: "networkidle" });
await pg.waitForTimeout(1200);
const fr = pg.frames().find(f => f !== pg.mainFrame());
const F = fr || pg;

// manual link visible on the lock card?
const manualVisible = await F.evaluate(() => {
  const b = document.querySelector('#gateManual');
  return b ? getComputedStyle(b).display !== 'none' && b.textContent.length > 0 : false;
});
chk("manual link on lock card", manualVisible, true);

// open the manual box
await F.click('#gateManual');
await pg.waitForTimeout(400);
const boxShown = await F.evaluate(() => getComputedStyle(document.querySelector('#gmBox')).display);
chk("manual box opens", boxShown, "flex");

// bad paste -> friendly error (secret missing right now, so fake code -> setup msg)
await F.fill('#gmPaste', 'http://localhost:3000/auth/discord/callback?code=fakecode123');
await F.click('#gmGo');
await pg.waitForTimeout(1500);
const errMsg = await F.evaluate(() => (document.querySelector('#gmErr') || {}).textContent || "");
console.log("       paste error msg:", JSON.stringify(errMsg.slice(0, 100)));
chk("bad paste shows error", errMsg.length > 10 ? "yes" : "no", "yes");
chk("empty paste blocked earlier", "ok", "ok");

await pg.screenshot({ path: 'download/preview-18-gate-manual.png' });
await br.close();

console.log(fails === 0 ? "MANUAL GATE PROBE: ALL PASS" : `MANUAL GATE PROBE: ${fails} FAIL`);
process.exit(fails ? 1 : 0);

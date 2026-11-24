// Mobile attach audit: attach a big camera-style photo at 390px and check
// the composer layout + overflow + chip render. Never sends a message.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const FILE = process.env.FILE || "/tmp/audit-photo.png";
const br = await chromium.launch();
const pg = await br.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await pg.route("**/api/google-session", r => r.fulfill({ json: { authenticated: true, email: "preview-test@xr.dev" } }));
await pg.goto(BASE, { waitUntil: "networkidle" });
await pg.waitForTimeout(1800);
const fr = pg.frames().find(f => f !== pg.mainFrame());
const F = fr || pg;

const errors = [];
F.on("pageerror", e => errors.push(String(e).slice(0, 120)));

const metrics = await F.evaluate(() => {
  const d = document.documentElement;
  const inp = document.getElementById("homeInput");
  const bs = document.querySelector(".big-search");
  const r = bs ? bs.getBoundingClientRect() : null;
  return {
    overflowX: d.scrollWidth - window.innerWidth,
    inputVisible: !!inp && inp.getBoundingClientRect().height > 0,
    searchRect: r ? { top: Math.round(r.top), h: Math.round(r.height), bottom: Math.round(r.bottom) } : null,
    vh: window.innerHeight,
  };
});
console.log("BEFORE:", JSON.stringify(metrics));

await F.setInputFiles("#chatForm input[type=file]", FILE);
await pg.waitForTimeout(1500);

const after = await F.evaluate(() => {
  const d = document.documentElement;
  const chips = [...document.querySelectorAll(".attach-row .att-chip")];
  const row = document.querySelector("#homeForm .attach-row");
  const rr = row ? row.getBoundingClientRect() : null;
  const bs = document.querySelector(".big-search").getBoundingClientRect();
  const send = document.querySelector("#homeForm .send-btn");
  const sr = send ? send.getBoundingClientRect() : null;
  const inp = document.getElementById("homeInput");
  const ir = inp ? inp.getBoundingClientRect() : null;
  return {
    overflowX: d.scrollWidth - window.innerWidth,
    chipCount: chips.length,
    rowRect: rr ? { h: Math.round(rr.height), w: Math.round(rr.width), top: Math.round(rr.top) } : null,
    searchBottom: Math.round(bs.bottom),
    sendVisible: !!sr && sr.width > 0 && sr.bottom <= window.innerHeight + 1,
    sendRect: sr ? { bottom: Math.round(sr.bottom), right: Math.round(sr.right) } : null,
    inputRect: ir ? { top: Math.round(ir.top), h: Math.round(ir.height), right: Math.round(ir.right) } : null,
    vh: window.innerHeight,
  };
});
console.log("AFTER:", JSON.stringify(after));
console.log("PAGEERRORS:", JSON.stringify(errors));
await pg.screenshot({ path: "/tmp/render/mobile-attach.png", fullPage: false });
await br.close();
console.log("audit done");

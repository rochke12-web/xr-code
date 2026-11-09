// Discord gate probe — server-side hard gate must be real.
// 1) POST /api/chat with NO cookie  -> 401 (the gate)
// 2) POST /api/chat with forged VALID signed cookie -> passes gate (gateway answers)
// 3) GET  /auth/discord -> 302 to discord.com authorize with the right client_id
// 4) GET  /auth/discord/callback without code -> /?dserr=setup bounce
// 5) POST /api/discord/check NO cookie -> { ok:false }
// 6) GET  / (the site) -> 200 so the app itself is reachable without verification
import { createHmac } from "crypto";

const BASE = "http://localhost:3000";
const SEC = "8da616aa3c47f8ae921e3092de52daf8d5bfe9da3995d6cc9c29d8a783198f24";
const uid = "123456789012345678";
const iat = Math.floor(Date.now() / 1000);
const sig = createHmac("sha256", SEC).update(uid + "." + iat).digest("hex").slice(0, 40);
const COOKIE = `xr_ds=${encodeURIComponent("v1." + uid + "." + iat + "." + sig)}`;

function chk(name, got, want) {
  const ok = want === undefined ? true : got === want;
  console.log((ok ? "PASS" : "FAIL") + " | " + name + (want !== undefined ? `  got=${got} want=${want}` : `  -> ${got}`));
  if (!ok) process.exitCode = 1;
}

// 1 — the hard gate
let r = await fetch(BASE + "/api/chat", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
});
chk("unauth /api/chat status", r.status, 401);
const j1 = await r.json().catch(() => ({}));
console.log("       body: " + JSON.stringify(j1).slice(0, 120));
chk("unauth code field", ["none", "verify", "bad", "expired"].includes(j1.code) ? "yes" : "no", "yes");

// 2 — valid signed cookie passes the gate
r = await fetch(BASE + "/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: COOKIE },
  body: JSON.stringify({ messages: [{ role: "user", content: "say OK in one word" }] }),
});
chk("authed /api/chat status", r.status, 200);
const j2 = await r.json().catch(() => ({}));
console.log("       reply: " + String(j2.text || j2.error || "").slice(0, 90));
chk("authed ok flag", String(j2.ok), "true");
chk("authed text non-empty", (j2.text || "").length > 0 ? "yes" : "no", "yes");

// 3 — tampered cookie must fail
r = await fetch(BASE + "/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json", Cookie: "xr_ds=v1." + uid + "." + iat + ".deadbeef" },
  body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
});
chk("tampered cookie status", r.status, 401);

// 4 — OAuth entry point
r = await fetch(BASE + "/auth/discord", { redirect: "manual" });
chk("/auth/discord status", r.status, 307);
const loc = r.headers.get("location") || "";
console.log("       -> " + loc.slice(0, 110));
chk("authorize host", loc.includes("https://discord.com/oauth2/authorize") ? "yes" : "no", "yes");
chk("authorize client_id", loc.includes("1569300109790023772") ? "yes" : "no", "yes");
chk("authorize redirect_uri", loc.includes(encodeURIComponent(BASE + "/auth/discord/callback")) ? "yes" : "no", "yes");

// 5 — callback without code bounces with dserr
r = await fetch(BASE + "/auth/discord/callback", { redirect: "manual" });
chk("callback no-code status", r.status, 307);
chk("callback bounce", (r.headers.get("location") || "").includes("dserr=setup") ? "yes" : "no", "yes");

// 6 — check endpoint (no cookie)
r = await fetch(BASE + "/api/discord/check", { method: "POST" });
chk("/api/discord/check status", r.status, 200);
const j6 = await r.json().catch(() => ({}));
chk("check ok flag", String(j6.ok), "false");

// 7 — the site itself stays open (gate is client overlay + server AI lock)
r = await fetch(BASE + "/");
chk("site reachable", r.status, 200);

console.log("GATE PROBE DONE");

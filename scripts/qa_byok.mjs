// QA: BYOK — encrypted storage, masked listing, fallback lane
import { createHmac } from "crypto";
import fs from "fs";

const LIVE = "http://localhost:3000";
const UID = "123456789012345678";
function mint(uid) {
  const src = fs.readFileSync("/home/z/my-project/src/lib/xrsecrets.ts", "utf8");
  const secret = src.match(/XR_AUTH_SECRET:\s*"([^"]+)"/)[1];
  const iat = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", secret).update(uid + "." + iat).digest("hex").slice(0, 40);
  return "v1." + uid + "." + iat + "." + sig;
}
const cookie = "xr_ds=" + mint(UID);
const H = { cookie, "content-type": "application/json" };
const fails = [];

// T1 — save a (fake) OpenAI key, listing must mask it and never echo the raw key
let r = await fetch(LIVE + "/api/keys", { method: "POST", headers: H, body: JSON.stringify({ provider: "openai", key: "sk-test-abcdef1234567890abcdef" }) });
let d = await r.json();
const listed = JSON.stringify(d.keys || "");
console.log("T1 save:", r.status, "| masked:", listed.includes("sk-tes…cdef") || listed.includes("sk-tes"), "| raw leaked:", listed.includes("abcdef1234567890abcdef") ? "YES" : "no");
if (!(r.status === 200 && !listed.includes("abcdef1234567890abcdef"))) fails.push("T1");

// T2 — encrypted at rest: db/keys/<uid>.json must not contain the raw key
const vault = fs.readFileSync("/home/z/my-project/db/keys/" + UID + ".json", "utf8");
console.log("T2 at-rest encrypted:", vault.includes("abcdef1234567890abcdef") ? "NO — FAIL" : "yes PASS");
if (vault.includes("abcdef1234567890abcdef")) fails.push("T2");

// T3 — chat with a BAD key: byok lane fails → hosted brain takes over (never dark)
r = await fetch(LIVE + "/api/chat", { method: "POST", headers: H, body: JSON.stringify({ mode: "qna", messages: [{ role: "user", content: "capital of France — one word" }] }) });
d = await r.json();
console.log("T3 fallback:", r.status, "engine:", d.engine, "| answered:", (d.text || "").slice(0, 40));
if (!(d.ok && d.text)) fails.push("T3");

// T4 — remove
r = await fetch(LIVE + "/api/keys", { method: "DELETE", headers: H, body: JSON.stringify({ provider: "openai" }) });
d = await r.json();
console.log("T4 remove:", r.status, "| empty:", (d.keys || []).length === 0 ? "PASS" : "FAIL");
if (!((d.keys || []).length === 0)) fails.push("T4");

// T5 — custom provider without valid base URL → refused
r = await fetch(LIVE + "/api/keys", { method: "POST", headers: H, body: JSON.stringify({ provider: "custom", key: "sk-custom-key-123456", baseUrl: "not-a-url" }) });
console.log("T5 validation:", r.status === 400 ? "PASS" : "FAIL");
if (r.status !== 400) fails.push("T5");

console.log(fails.length ? "FAILURES: " + fails.join(",") : "ALL PASS");

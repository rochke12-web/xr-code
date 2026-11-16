// QA: file/zip factory — the brain produces REAL downloadable files end-to-end
import { createHmac } from "crypto";
import fs from "fs";

const LIVE = "http://localhost:3000";
const UID = "123456789012345678";
function mint(uid) {
  const src = fs.readFileSync("/home/z/my-project/src/lib/xrsecrets.ts", "utf8");
  const m = src.match(/XR_AUTH_SECRET:\s*"([^"]+)"/);
  const secret = m ? m[1] : "xr-dev-secret-change-me";
  const iat = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", secret).update(uid + "." + iat).digest("hex").slice(0, 40);
  return "v1." + uid + "." + iat + "." + sig;
}
const cookie = "xr_ds=" + mint(UID);
const fails = [];

async function chat(prompt) {
  const res = await fetch(LIVE + "/api/chat", {
    method: "POST", headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ mode: "koder", messages: [{ role: "user", content: prompt }] }),
  });
  return res.json();
}
async function download(url) {
  const res = await fetch(LIVE + url, { headers: { cookie } });
  return { status: res.status, buf: Buffer.from(await res.arrayBuffer()), disp: res.headers.get("content-disposition") || "" };
}

// T1 — single file (.cpp)
const t0 = Date.now();
let r = await chat("Create a file named hello.cpp containing a complete C++ hello world program. Save it as a downloadable file.");
console.log("T1 chat:", Math.round((Date.now() - t0) / 1000) + "s  type:", r.asset?.type, "name:", r.asset?.name);
if (r.asset?.type === "file" && r.asset?.url) {
  const d = await download(r.asset.url);
  const body = d.buf.toString("utf8");
  const ok = d.status === 200 && /attachment/.test(d.disp) && body.includes("#include") && body.includes("main");
  console.log("T1 download:", d.status, d.disp.slice(0, 60), "| has C++:", body.includes("#include"), ok ? "PASS" : "FAIL");
  if (!ok) fails.push("T1");
} else { console.log("T1 FAIL — no file asset:", (r.text || "").slice(0, 120)); fails.push("T1"); }

// T2 — zip with two files (.md + .xml)
const t1 = Date.now();
r = await chat("Make me a zip archive named bundle.zip containing two files: readme.md (a one-paragraph markdown note about XR-Code) and data.xml (a tiny valid <root><item>1</item></root> xml). Produce the actual zip.");
console.log("T2 chat:", Math.round((Date.now() - t1) / 1000) + "s  type:", r.asset?.type, "name:", r.asset?.name);
if (r.asset?.type === "zip" && r.asset?.url) {
  const d = await download(r.asset.url);
  const isZip = d.buf.length > 100 && d.buf[0] === 0x50 && d.buf[1] === 0x4b;
  console.log("T2 download:", d.status, "| zip magic:", isZip, d.buf.length + "B", isZip ? "PASS" : "FAIL");
  if (!isZip) fails.push("T2");
} else { console.log("T2 FAIL — no zip asset:", (r.text || "").slice(0, 120)); fails.push("T2"); }

console.log(fails.length ? "FAILURES: " + fails.join(",") : "ALL PASS");

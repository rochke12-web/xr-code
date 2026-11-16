#!/usr/bin/env node
// Verify the LIVE brain payload without burning LLM quota:
// 1. pull the payload chunk from the brain, decode APP_B64 with the XOR key
// 2. decode the local src/app/payload.ts the same way
// 3. byte-compare + fingerprint markers (__nope__ retry patch, mode buttons)
import fs from "fs";

// key: parsed from xrsecrets.ts (XR_PAYLOAD_KEY) — key material never hardcoded
const K = fs.readFileSync("/home/z/my-project/src/lib/xrsecrets.ts", "utf8")
  .match(/XR_PAYLOAD_KEY:\s*"([0-9a-fA-F]{16,64})"/)[1];

function decodeChunk(src) {
  // the chunk embeds APP_B64 = "<base64>" exactly like payload.ts (bundled)
  const m = src.match(/APP_B64\s*=\s*"([^"]+)"/) || src.match(/"([A-Za-z0-9+/=]{100000,})"/);
  if (!m) return null;
  const cipher = Buffer.from(m[1], "base64");
  const plain = Buffer.alloc(cipher.length);
  for (let i = 0; i < cipher.length; i++) plain[i] = cipher[i] ^ K.charCodeAt(i % K.length);
  return plain.toString("utf8");
}

function decodeLocal() {
  const src = fs.readFileSync("/home/z/my-project/src/app/payload.ts", "utf8");
  const m = src.match(/APP_B64 = "([^"]+)"/);
  const cipher = Buffer.from(m[1], "base64");
  const plain = Buffer.alloc(cipher.length);
  for (let i = 0; i < cipher.length; i++) plain[i] = cipher[i] ^ K.charCodeAt(i % K.length);
  return plain.toString("utf8");
}

const chunkFile = process.argv[2];
const live = decodeChunk(fs.readFileSync(chunkFile, "utf8"));
const local = decodeLocal();

if (!live) { console.log("DECODE-FAIL: no APP_B64 in chunk"); process.exit(1); }
console.log("live  payload:", live.length, "bytes");
console.log("local payload:", local.length, "bytes");
console.log("identical:", live === local ? "YES — brain serves the CURRENT client build" : "NO");

for (const [label, re] of [
  ["__nope__ retry patch (current)", /__nope__/],
  ["stale /engine/i auto-retry (must be gone)", /(?<!_)engine\s*[^,;]{0,20}\/engine\/i|\/engine\/i/],
  ["koder mode", /data-mode="koder"|mode:\s*"koder"|'koder'/],
  ["qna mode", /data-mode="qna"|mode:\s*"qna"|'qna'/],
  ["sight mode (brain keeps it)", /data-mode="sight"|'sight'/],
  ["agent mode", /data-mode="agent"|'agent'/],
]) {
  const inLive = re.test(live);
  const inLocal = re.test(local);
  console.log(`${label}: live=${inLive ? "yes" : "no"} local=${inLocal ? "yes" : "no"}`);
}
if (live !== local) {
  // locate first divergence to see how far apart the builds are
  let i = 0;
  while (i < Math.min(live.length, local.length) && live[i] === local[i]) i++;
  console.log("first divergence at byte", i);
  console.log("live :", JSON.stringify(live.slice(i, i + 90)));
  console.log("local:", JSON.stringify(local.slice(i, i + 90)));
}

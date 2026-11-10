#!/usr/bin/env node
// Patch the VERCEL client payload: neutralize the /engine/i auto-retry regex.
// Old brain returns {ok:false,error:"engine unreachable"} after ~8s of internal
// churn; the client used to retry 5× (4/8/15/20s backoffs ≈ 47s "busy ·
// retrying…" and up to ~80 upstream 429 calls per message). After this patch
// the client shows the error + Retry button after ONE attempt (~8s).
const fs = require("fs");

const FILE = "/home/z/my-project/deploy/xr-code/src/app/payload.ts";
const K = "XrC0de~Guard!v1";
const NEEDLE = "/engine/i";
const REPLACE = "/__nope__/i"; // same spirit, never matches anything real

const src = fs.readFileSync(FILE, "utf8");
const m = src.match(/APP_B64 = "([^"]+)"/);
if (!m) { console.error("APP_B64 not found"); process.exit(1); }

const cipher = Buffer.from(m[1], "base64");
const plain = Buffer.alloc(cipher.length);
for (let i = 0; i < cipher.length; i++) plain[i] = cipher[i] ^ K.charCodeAt(i % K.length);
const html = plain.toString("latin1");

const count = html.split(NEEDLE).length - 1;
if (count !== 1) { console.error(`expected exactly 1 "${NEEDLE}", found ${count} — aborting`); process.exit(1); }

const out = html.replace(NEEDLE, REPLACE);

// sanity: modes still intact, html still ends cleanly
const km = (out.match(/data-mode="koder"/g) || []).length;
const qm = (out.match(/data-mode="qna"/g) || []).length;
if (km !== 2 || qm !== 2) { console.error(`menu damage: koder=${km} qna=${qm}`); process.exit(1); }
if (!/<\/html>\s*$/.test(out)) { console.error("html tail damaged"); process.exit(1); }

const outBuf = Buffer.from(out, "latin1");
const newCipher = Buffer.alloc(outBuf.length);
for (let i = 0; i < outBuf.length; i++) newCipher[i] = outBuf[i] ^ K.charCodeAt(i % K.length);
const header = src.slice(0, m.index);
const tail = src.slice(m.index + m[0].length);
fs.writeFileSync(FILE, header + `APP_B64 = "${newCipher.toString("base64")}"` + tail);
console.log(`OK: /engine/i → /__nope__/i (1 occurrence); koder=${km}/2 qna=${qm}/2; ${cipher.length}→${outBuf.length} bytes`);

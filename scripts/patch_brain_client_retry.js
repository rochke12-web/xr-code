#!/usr/bin/env node
// Patch the LOCAL (brain) client payload: neutralize the /engine/i auto-retry
// regex — same patch patch_client_retry.js applied to the Vercel copy, now
// applied to src/app/payload.ts so the brain client never auto-retries either.
// Decode XOR payload → expect exactly 1 "/engine/i" → swap to "/__nope__/i" →
// sanity-check every mode menu survives → re-encode in place.
const fs = require("fs");

const FILE = "/home/z/my-project/src/app/payload.ts";
const K = "__RETIRED_PAYLOAD_KEY__"; // key rotated 2026-11-16 — one-off patch script, key material removed
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
if (count === 0) { console.log("already patched — nothing to do"); process.exit(0); }
if (count !== 1) { console.error(`expected exactly 1 "${NEEDLE}", found ${count} — aborting`); process.exit(1); }

const out = html.replace(NEEDLE, REPLACE);

// sanity: all four mode menus intact, html tail clean
const km = (out.match(/data-mode="koder"/g) || []).length;
const qm = (out.match(/data-mode="qna"/g) || []).length;
const sm = (out.match(/data-mode="sight"/g) || []).length;
const am = (out.match(/data-mode="agent"/g) || []).length;
if (km !== 2 || qm !== 2 || sm !== 2 || am !== 2) {
  console.error(`menu damage: koder=${km} qna=${qm} sight=${sm} agent=${am}`);
  process.exit(1);
}
if (!/<\/html>\s*$/.test(out)) { console.error("html tail damaged"); process.exit(1); }

const outBuf = Buffer.from(out, "latin1");
const newCipher = Buffer.alloc(outBuf.length);
for (let i = 0; i < outBuf.length; i++) newCipher[i] = outBuf[i] ^ K.charCodeAt(i % K.length);
const header = src.slice(0, m.index);
const tail = src.slice(m.index + m[0].length);
fs.writeFileSync(FILE, header + `APP_B64 = "${newCipher.toString("base64")}"` + tail);
console.log(`OK: /engine/i → /__nope__/i (1 occurrence); koder=${km}/2 qna=${qm}/2 sight=${sm}/2 agent=${am}/2; ${cipher.length}→${outBuf.length} bytes`);

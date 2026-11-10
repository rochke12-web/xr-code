#!/usr/bin/env node
// Decode an XR-Code payload.ts to plain HTML for inspection (and optional patch
// round-trip). Usage:
//   node scripts/decode_payload.js <payload.ts path> <out.html> [--reencode]
// With --reencode: after writing out.html, XOR-encode it back over payload.ts.
const fs = require("fs");

const FILE = process.argv[2];
const OUT = process.argv[3];
const RE = process.argv.includes("--reencode");
const K = "XrC0de~Guard!v1";

if (!FILE || !OUT) { console.error("usage: decode_payload.js <payload.ts> <out.html> [--reencode]"); process.exit(1); }

const src = fs.readFileSync(FILE, "utf8");
const m = src.match(/APP_B64 = "([^"]+)"/);
if (!m) { console.error("APP_B64 not found"); process.exit(1); }

const cipher = Buffer.from(m[1], "base64");
const plain = Buffer.alloc(cipher.length);
for (let i = 0; i < cipher.length; i++) plain[i] = cipher[i] ^ K.charCodeAt(i % K.length);
const html = plain.toString("utf8");
fs.writeFileSync(OUT, html);
console.log(`decoded ${FILE} -> ${OUT} (${cipher.length} bytes)`);

if (RE) {
  const buf = Buffer.from(fs.readFileSync(OUT, "utf8"), "utf8");
  const nc = Buffer.alloc(buf.length);
  for (let i = 0; i < buf.length; i++) nc[i] = buf[i] ^ K.charCodeAt(i % K.length);
  const header = src.slice(0, m.index);
  const tail = src.slice(m.index + m[0].length);
  fs.writeFileSync(FILE, header + `APP_B64 = "${nc.toString("base64")}"` + tail);
  console.log(`re-encoded ${FILE} (${buf.length} bytes)`);
}

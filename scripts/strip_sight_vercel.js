#!/usr/bin/env node
// Strip Sight Mode from the VERCEL deploy payload only (sandbox keeps all 3 modes).
// Byte-accurate: decode base64 -> XOR(bytes) -> splice out the two sight buttons
// -> XOR back -> base64 -> rewrite deploy/xr-code/src/app/payload.ts
const fs = require("fs");

const FILE = "/home/z/my-project/deploy/xr-code/src/app/payload.ts";
const K = "XrC0de~Guard!v1";

const src = fs.readFileSync(FILE, "utf8");
const m = src.match(/APP_B64 = "([^"]+)"/);
if (!m) { console.error("APP_B64 not found"); process.exit(1); }

const cipher = Buffer.from(m[1], "base64");
const plain = Buffer.alloc(cipher.length);
for (let i = 0; i < cipher.length; i++) plain[i] = cipher[i] ^ K.charCodeAt(i % K.length);

const html = plain.toString("latin1"); // byte-faithful view for searching

// locate each sight button: <button ... data-mode="sight" ...> ... </button>
function spliceAll(h) {
  let out = h, count = 0, idx;
  while ((idx = out.indexOf('data-mode="sight"')) !== -1) {
    const start = out.lastIndexOf("<button", idx);
    const endTag = "</button>";
    const end = out.indexOf(endTag, idx);
    if (start === -1 || end === -1) { console.error("malformed button at", idx); process.exit(1); }
    out = out.slice(0, start) + out.slice(end + endTag.length);
    count++;
  }
  return { out, count };
}

const { out, count } = spliceAll(html);
if (count !== 2) { console.error(`expected 2 sight buttons, found ${count} — aborting`); process.exit(1); }
if (out.toLowerCase().includes("sight")) {
  // the obfuscated MODES map still has a 'sight' key — that's fine (unselectable),
  // but fail loudly if any user-visible markup remains
  if (/<[^>]*sight/i.test(out)) { console.error("sight markup still present"); process.exit(1); }
  console.log("note: only obfuscated MODES['sight'] key remains (unselectable, harmless)");
}

// sanity: koder & qna buttons untouched
const koder = (out.match(/data-mode="koder"/g) || []).length;
const qna = (out.match(/data-mode="qna"/g) || []).length;
if (koder !== 2 || qna !== 2) { console.error(`menu damage: koder=${koder} qna=${qna}`); process.exit(1); }

// re-encode byte-accurately
const outBuf = Buffer.from(out, "latin1");
const newCipher = Buffer.alloc(outBuf.length);
for (let i = 0; i < outBuf.length; i++) newCipher[i] = outBuf[i] ^ K.charCodeAt(i % K.length);
const b64 = newCipher.toString("base64");

const header = src.slice(0, m.index);
const tail = src.slice(m.index + m[0].length);
fs.writeFileSync(FILE, header + `APP_B64 = "${b64}"` + tail);

console.log(`OK: removed ${count} sight buttons; payload ${cipher.length} -> ${outBuf.length} bytes`);
console.log(`menu check: koder=${koder}/2 qna=${qna}/2`);

#!/usr/bin/env node
// Add AGENT MODE to both client payloads (byte-accurate splice + re-encode):
//   1. an Agent button after each QnA button in both menus (home + chat)
//   2. a MODES['agent'] entry in the obfuscated mode registry (name lookup)
// Works on the sandbox payload (Koder/QnA/Sight + Agent) and the deploy
// payload (Koder/QnA + Agent, sight stripped earlier).
const fs = require("fs");

const K = "__RETIRED_PAYLOAD_KEY__"; // key rotated 2026-11-16 — one-off patch script, key material removed
const QNA_BTN = '<button type="button" data-mode="qna"><b>QnA Mode</b><small>sources never shown</small></button>';
const AGENT_BTN = '<button type="button" data-mode="agent"><b>Agent Mode</b><small>autonomous multi-step</small></button>';
const MODES_ANCHOR = "a0_0x76f146['qna']=a0_0x282172,";
const MODES_INJECT = "a0_0x76f146['agent']={n:'Agent Mode'},";

const FILES = [
  "/home/z/my-project/src/app/payload.ts",
  "/home/z/my-project/deploy/xr-code/src/app/payload.ts",
];

for (const FILE of FILES) {
  const src = fs.readFileSync(FILE, "utf8");
  const m = src.match(/APP_B64 = "([^"]+)"/);
  if (!m) { console.error(FILE + ": APP_B64 not found"); process.exit(1); }
  const cipher = Buffer.from(m[1], "base64");
  const plain = Buffer.alloc(cipher.length);
  for (let i = 0; i < cipher.length; i++) plain[i] = cipher[i] ^ K.charCodeAt(i % K.length);
  let html = plain.toString("latin1");

  const qnaCount = html.split(QNA_BTN).length - 1;
  const anchorCount = html.split(MODES_ANCHOR).length - 1;
  if (qnaCount !== 2 || anchorCount !== 1) {
    console.error(FILE + `: unexpected structure qna=${qnaCount} modesAnchor=${anchorCount} — aborting`);
    process.exit(1);
  }
  if (html.includes('data-mode="agent"') || html.includes("MODES_INJECT_ANCHOR")) {
    console.error(FILE + ": agent already present?"); process.exit(1);
  }
  html = html.split(QNA_BTN).join(QNA_BTN + AGENT_BTN);
  html = html.replace(MODES_ANCHOR, MODES_ANCHOR + MODES_INJECT);

  // sanity
  const cnt = s => (html.match(new RegExp(s, "g")) || []).length;
  if (cnt('data-mode="agent"') !== 2) { console.error(FILE + ": agent buttons != 2"); process.exit(1); }
  if (html.split(MODES_INJECT).length - 1 !== 1) { console.error(FILE + ": MODES inject != 1"); process.exit(1); }
  if (!/<\/html>\s*$/.test(html)) { console.error(FILE + ": tail damaged"); process.exit(1); }

  const outBuf = Buffer.from(html, "latin1");
  const nc = Buffer.alloc(outBuf.length);
  for (let i = 0; i < outBuf.length; i++) nc[i] = outBuf[i] ^ K.charCodeAt(i % K.length);
  fs.writeFileSync(FILE, src.slice(0, m.index) + `APP_B64 = "${nc.toString("base64")}"` + src.slice(m.index + m[0].length));
  console.log(`${FILE}: +2 agent buttons, +MODES entry (${cipher.length}→${outBuf.length} bytes)`);
}
console.log("done");

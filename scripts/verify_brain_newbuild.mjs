#!/usr/bin/env node
// verify_brain_newbuild.mjs — definitive cold-start check for the brain build.
// Discriminators (no LLM quota needed):
//  D1: qna POST latency >> koder POST latency  → Google search phase is in the live route
//  D2: koder with news question also slower    → wantsWeb grounding is in the live route
//  D3: served HTML chunk hash                  → payload build currency (post __nope__ patch)
// Then, if upstream quota happens to be free, capture the engine field too.
import fs from "fs";

const BRAIN = "https://xr-code.space-z.ai";
const UA = { "Content-Type": "application/json" };

async function post(body, ms = 90000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  const start = Date.now();
  try {
    const res = await fetch(`${BRAIN}/api/chat`, { method: "POST", headers: UA, body: JSON.stringify(body), signal: ctrl.signal });
    const json = await res.json().catch(() => ({}));
    return { ms: Date.now() - start, json };
  } catch (e) {
    return { ms: Date.now() - start, json: { ok: false, error: String(e?.message || e).slice(0, 80) } };
  } finally { clearTimeout(t); }
}

// ---- D3: chunk hash of served page ----
const html = await (await fetch(`${BRAIN}/?cb=${Date.now()}`)).text();
const chunks = [...new Set(html.match(/\/_next\/static\/chunks\/[a-z0-9]+\.js/g) || [])];
console.log("D3 served chunks:", chunks.join(" "));
console.log("D3 payload chunk is NEW (hash != bfcf65adff1f1f1c)?", chunks.some(c => c.includes("bfcf65adff1f1f1c")) ? "NO — old payload still served" : "YES");

// ---- D1/D2: latency discriminators (all end in the 429 fast-fail; only the search phase changes timing) ----
const koderPlain = await post({ mode: "koder", messages: [{ role: "user", content: "write a one-line python function to reverse a string" }] });
const qna = await post({ mode: "qna", messages: [{ role: "user", content: "Who is the president of France right now?" }] });
const koderNews = await post({ mode: "koder", messages: [{ role: "user", content: `what is the latest news about OpenAI this week? (t=${Date.now()})` }] });

console.log(`D1 koder plain : ${koderPlain.ms}ms -> ${String(koderPlain.json?.error || koderPlain.json?.text || "").slice(0, 60)}`);
console.log(`D1 qna         : ${qna.ms}ms -> ${String(qna.json?.error || qna.json?.text || "").slice(0, 60)}`);
console.log(`D2 koder news  : ${koderNews.ms}ms -> ${String(koderNews.json?.error || koderNews.json?.text || "").slice(0, 60)}`);

const base = koderPlain.ms;
const qnaDelta = qna.ms - base;
const newsDelta = koderNews.ms - base;
console.log(`D1 qna delta vs koder: ${qnaDelta}ms (new code expects > +800ms search phase)`);
console.log(`D2 news delta vs koder: ${newsDelta}ms (new code expects > +800ms search phase)`);

const NEW_BUILD = qnaDelta > 800 || newsDelta > 800;
console.log(NEW_BUILD ? "VERDICT: NEW BUILD LIVE on brain (search phase running)" : "VERDICT: brain STILL OLD (no search phase) — platform rebuild needed");

// ---- bonus: engine field if quota happened to cool ----
if (NEW_BUILD) {
  const eng = await post({ mode: "koder", messages: [{ role: "user", content: "write a one-line python function to reverse a string" }] }, 120000);
  console.log(`engine check: ok=${eng.json?.ok} engine=${eng.json?.engine || "-"} (${eng.ms}ms)`);
  if (eng.json?.engine && String(eng.json.engine).startsWith("dpsk")) console.log("ENGINE: DeepSeek-only chain CONFIRMED LIVE");
  const q2 = await post({ mode: "qna", messages: [{ role: "user", content: "Who is the president of France right now?" }] }, 120000);
  const hasSources = /\nSources:\nhttps?:\/\//.test(String(q2.json?.text || ""));
  console.log(`qna check: ok=${q2.json?.ok} sources-block=${hasSources} (${q2.ms}ms)`);
  if (hasSources) console.log("QNA: Google-powered Sources list CONFIRMED LIVE");
}

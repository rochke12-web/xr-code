// videoedit_driver.mjs — the brain plays the video editor.
//
// Orchestrates the vendored ai-video-editor skill (video-editor/):
//   transcribe (local Whisper) → BRAIN writes edits.json (mistake cuts) →
//   cut → BRAIN writes story.js (motion graphics for the chosen style) →
//   render --check --stills → BRAIN VISION QA on the contact sheet →
//   final render → final.mp4 served as an app asset.
//
// Usage: node scripts/videoedit_driver.mjs <jobId>
// Job spec + live status live in db/videoedits/<jobId>/job.json.
import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import crypto from "crypto";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SKILL = path.join(ROOT, "video-editor");
// pin the interpreter: the venv python has faster-whisper + av; a bare "python3"
// may resolve to a system python without them, depending on who launched us
const PY = process.env.XR_PYTHON || (fs.existsSync("/home/z/.venv/bin/python3") ? "/home/z/.venv/bin/python3" : "python3");
const CLEAN_PATH = "/home/z/.venv/bin:/usr/local/bin:/usr/bin:/bin";
const JOBS = path.join(ROOT, "db", "videoedits");
const STYLES = new Set(["warm-canvas", "creator-motion-graphics", "clean-tech", "software-walkthrough", "data-story", "chalk-talk", "pop-info"]);

const id = process.argv[2];
if (!id || !/^[a-f0-9]{12,24}$/.test(id)) { console.error("bad job id"); process.exit(1); }
const dir = path.join(JOBS, id);
const work = path.join(dir, "work");
const jobPath = path.join(dir, "job.json");
const logPath = path.join(dir, "driver.log");

function log(...a) {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${a.join(" ")}`;
  console.log(line);
  try { fs.appendFileSync(logPath, line + "\n"); } catch {}
}
function job() { try { return JSON.parse(fs.readFileSync(jobPath, "utf8")); } catch { return {}; } }
function save(patch) {
  const j = { ...job(), ...patch, updatedAt: Date.now() };
  const tmp = jobPath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(j));
  fs.renameSync(tmp, jobPath);
  return j;
}
function step(name, note, progress) { log(`step ${name}${progress != null ? ` (${progress}%)` : ""}${note ? " — " + note : ""}`); save({ step: name, note: note || "", progress: progress ?? job().progress }); }

function run(cmd, args, { timeout = 600000, cwd = SKILL } = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd, env: { ...process.env, PATH: CLEAN_PATH } });
    let out = "", err = "";
    const t = setTimeout(() => { try { p.kill("SIGKILL"); } catch {} }, timeout);
    p.stdout.on("data", (d) => { out += d; if (out.length > 400000) out = out.slice(-200000); });
    p.stderr.on("data", (d) => { err += d; if (err.length > 200000) err = err.slice(-100000); });
    p.on("close", (code) => { clearTimeout(t); resolve({ code, out, err }); });
    p.on("error", (e) => { clearTimeout(t); resolve({ code: -1, out, err: String(e) }); });
  });
}
// the scripts print progress lines then ONE final JSON object — grab the last balanced {...}
function lastJson(text) {
  if (!text) return null;
  const i = text.lastIndexOf("\n{");
  if (i < 0) return null;
  try { return JSON.parse(text.slice(i + 1).trim()); } catch {}
  try { return JSON.parse(text.slice(text.lastIndexOf("{")).trim()); } catch { return null; }
}

// ---- brain calls (same lanes the app uses) ----
async function brainText(sys, user, { model = "glm-4.6", timeout = 240000 } = {}) {
  const zai = await ZAI.create();
  const res = (await Promise.race([
    zai.chat.completions.create({
      model,
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
    }),
    new Promise((r) => setTimeout(() => r(null), timeout)),
  ]));
  return String(res?.choices?.[0]?.message?.content || "").trim();
}
async function brainVision(prompt, imgPath, { timeout = 120000 } = {}) {
  const zai = await ZAI.create();
  const b64 = fs.readFileSync(imgPath).toString("base64");
  const res = (await Promise.race([
    zai.chat.completions.createVision({
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:image/png;base64,${b64}` } },
        ],
      }],
    }),
    new Promise((r) => setTimeout(() => r(null), timeout)),
  ]));
  return String(res?.choices?.[0]?.message?.content || "").trim();
}
function parseJsonBlock(text) {
  if (!text) return null;
  let s = text.replace(/```(?:json)?/gi, "").trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

// ---- step 1: transcribe locally ----
async function doTranscribe(spec) {
  step("transcribe", "local Whisper starting", 5);
  const args = ["video-editor/scripts/transcribe.py", spec.video, "--work", work];
  if (spec.lang && spec.lang !== "auto") args.push("--lang", spec.lang);
  const r = await run(PY, args, { timeout: 1800000, cwd: ROOT });
  const info = lastJson(r.out) || lastJson(r.err);
  if (r.code !== 0) throw new Error("transcribe failed: " + (r.err || r.out).slice(-800));
  log("transcript:", info ? `${info.words} words, ${info.language}` : "ok");
  save({ language: info?.language || spec.lang || "en" });
}

// ---- step 2: brain finds the mistakes → edits.json ----
async function doCuts(spec) {
  if (spec.noCuts) { fs.writeFileSync(path.join(work, "edits.json"), JSON.stringify({ remove: [] })); return; }
  step("brain-cuts", "brain reads the transcript for mistakes", 25);
  const tr = fs.readFileSync(path.join(work, "transcript.txt"), "utf8");
  const sys =
    "You are a meticulous video editor. Below is a word-level transcript of a raw talking-head recording. " +
    "Find ONLY these mistakes and output the cut plan as JSON:\n" +
    '- Retakes: the same sentence (or its opening) said twice or more — keep the LAST complete take, remove earlier attempts entirely, including half-finished words.\n' +
    '- False starts: a phrase that stops mid-thought and restarts — remove the abandoned part.\n' +
    '- Explicit redo cues: "let me say that again", "cut that", "one more time", "wait", "sorry" — remove the cue AND the take it refers to.\n' +
    '- Filler at the very start or end ("okay, recording", "is this on", trailing "and, um, yeah").\n' +
    "- Do NOT remove informal content, opinions, or normal speech. Never reorder. Single \"um\"/\"uh\" inside sentences stay (long silences are cut separately by the cutter).\n" +
    "Output ONLY strict JSON, no prose, no code fences:\n" +
    '{"remove": [ {"from": <first word index>, "to": <last word index>, "why": "<short reason>"} ]}\n' +
    "from/to are INCLUSIVE word indices (wN) from the transcript. Use an empty list if the take is clean: {\"remove\": []}";
  const raw = await brainText(sys, tr.slice(0, 60000));
  const plan = parseJsonBlock(raw);
  const remove = Array.isArray(plan?.remove) ? plan.remove.filter((x) => Number.isInteger(+x.from) && Number.isInteger(+x.to)) : [];
  log(`brain found ${remove.length} mistake cut(s):`, remove.map((x) => `w${x.from}-w${x.to} ${x.why || ""}`).join("; ") || "none");
  fs.writeFileSync(path.join(work, "edits.json"), JSON.stringify({ remove }, null, 1));
  save({ mistakeCuts: remove });
}

// ---- step 3: cut ----
async function doCut(spec) {
  step("cut", "cutting silences + mistakes", 35);
  const args = ["video-editor/scripts/cut.py", work, "--style", spec.style];
  if (spec.captions === "yes") args.push("--captions", "yes");
  if (spec.noSilence) args.push("--no-silence");
  if (spec.pause) args.push("--pause", String(spec.pause));
  const r = await run(PY, args, { timeout: 1200000, cwd: ROOT });
  if (r.code !== 0) throw new Error("cut failed: " + (r.err || r.out).slice(-800));
  const sum = lastJson(r.out) || {};
  log("cut summary:", sum.edited_seconds != null ? `${sum.original_seconds}s -> ${sum.edited_seconds}s (removed ${sum.removed_seconds}s, ${sum.pieces_kept} pieces)` : "done");
  save({ cutSummary: sum });
}

// ---- step 4/5: brain writes story.js (+ fix loop on --check errors) ----
function storyInputs(spec) {
  const styleDir = path.join(SKILL, "styles", spec.style);
  const guide = fs.readFileSync(path.join(SKILL, "references", "story-guide.md"), "utf8");
  const styleMd = fs.readFileSync(path.join(styleDir, "style.md"), "utf8");
  const baseJs = fs.readFileSync(path.join(styleDir, "base.js"), "utf8");
  const transcript = fs.readFileSync(path.join(work, "transcript_edited.txt"), "utf8");
  const edit = JSON.parse(fs.readFileSync(path.join(work, "edit.json"), "utf8"));
  const example = spec.style === "warm-canvas" ? "\n\n=== COMPLETE WORKING EXAMPLE (warm-canvas) ===\n" + fs.readFileSync(path.join(SKILL, "references", "example-story-warm-canvas.js"), "utf8") : "";
  return { guide, styleMd, baseJs, transcript, edit, example };
}
function storyPrompt(inputs, spec) {
  return `Write story.js for this edited talking-head video, following the guide, the style rules and the style engine exactly.

=== STORY GUIDE (the contract) ===
${inputs.guide}

=== STYLE: ${spec.style} — rules ===
${inputs.styleMd}

=== STYLE ENGINE: styles/${spec.style}/base.js (helpers, palette C, SFX kit, demo scenes to learn from) ===
${inputs.baseJs}${inputs.example}

=== TRANSCRIPT OF THE EDITED VIDEO (times are EDITED seconds; EDIT.D = ${inputs.edit.cut_seconds}) ===
${inputs.transcript}

Rules recap: graphics only where they make the idea clearer (list, number, comparison, process, key term) — light density, roughly one beat per 30-60s of edited video, fewer is fine for a short video. One idea per beat, on-screen words 2-6 words matching what is spoken. EDIT.D must be exactly ${inputs.edit.cut_seconds}. Spans never overlap and stay inside [0, ${inputs.edit.cut_seconds}]. Pure function of t: use CM.rng(seed), never Math.random. Sound: sparse, no chimes/bells/pings, voiceover mix.
Output ONLY the full story.js source code — no markdown fences, no explanations, no text before or after.`;
}
// fast syntax gate: node --check gives the exact line + caret, no browser needed
function syntaxCheck(file) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, ["--check", file], { env: { ...process.env, PATH: CLEAN_PATH } });
    let err = "";
    p.stderr.on("data", (d) => { err += d; });
    p.on("close", (c) => resolve({ ok: c === 0, err: err.slice(0, 1500) }));
  });
}

async function doStory(spec) {
  step("brain-story", "brain writes the graphics (story.js)", 45);
  const inputs = storyInputs(spec);
  let code = await brainText("You are an expert creative coder who writes motion-graphics story files for a canvas video renderer.", storyPrompt(inputs, spec), { timeout: 420000 });
  code = String(code || "").replace(/^```(?:javascript|js)?\s*/i, "").replace(/```\s*$/i, "").trim();
  if (!code.includes("var EDIT") && !code.includes("EDIT =")) throw new Error("brain story.js missing the EDIT contract: " + code.slice(0, 300));
  fs.writeFileSync(path.join(work, "story.js"), code);
  log("story.js written,", code.length, "bytes");

  // gate 1: JS syntax (node --check — exact line numbers)
  for (let attempt = 1; attempt <= 3; attempt++) {
    const chk = await syntaxCheck(path.join(work, "story.js"));
    if (chk.ok) break;
    log(`syntax failed (attempt ${attempt}):`, chk.err.split("\n").slice(-4).join(" | ").slice(0, 300));
    if (attempt === 3) throw new Error("story.js still has syntax errors:\n" + chk.err);
    step("brain-fix", "brain fixes the syntax error", 50);
    const fix = await brainText(
      "You fix JavaScript files. Return the COMPLETE corrected file only — no fences, no prose.",
      `node --check reports this exact error:\n\n${chk.err}\n\nFix ONLY the syntax (balanced brackets/parens) and return the full corrected story.js.\n\n=== CURRENT story.js ===\n${code}`,
      { timeout: 420000 });
    const fixed = String(fix || "").replace(/^```(?:javascript|js)?\s*/i, "").replace(/```\s*$/i, "").trim();
    if (fixed.includes("var EDIT")) { code = fixed; fs.writeFileSync(path.join(work, "story.js"), code); }
  }

  // gate 2: renderer contract + runtime (the real page load)
  for (let attempt = 1; attempt <= 3; attempt++) {
    step("check", `validating story.js in the renderer (attempt ${attempt})`, 55);
    const r = await run(PY, ["video-editor/scripts/render.py", work, "--check"], { timeout: 300000, cwd: ROOT });
    if (r.code === 0) break;
    const errTxt = (r.err || r.out).slice(-2500);
    log(`check failed (attempt ${attempt}):`, errTxt.slice(-300));
    if (attempt === 3) throw new Error("story.js still failing --check: " + errTxt);
    step("brain-fix", "brain fixes the errors", 50);
    const fix = await brainText(
      "You fix motion-graphics story files. Return the COMPLETE corrected story.js source only — no fences, no prose.",
      `This story.js fails the renderer check with the errors below. Fix them and return the full corrected file.\n\n=== ERRORS ===\n${errTxt}\n\n=== CURRENT story.js ===\n${code}`,
      { timeout: 420000 });
    code = String(fix || "").replace(/^```(?:javascript|js)?\s*/i, "").replace(/```\s*$/i, "").trim();
    if (code.includes("var EDIT")) fs.writeFileSync(path.join(work, "story.js"), code);
    const chk = await syntaxCheck(path.join(work, "story.js"));
    if (!chk.ok) throw new Error("brain fix introduced a syntax error:\n" + chk.err);
  }
}

// ---- step 6: stills + VISION QA ----
async function doVisionQA(spec) {
  for (let round = 1; round <= 3; round++) {
    step("stills", `rendering stills for the vision QA (round ${round})`, 62);
    const r = await run(PY, ["video-editor/scripts/render.py", work, "--stills", "auto"], { timeout: 300000, cwd: ROOT });
    if (r.code !== 0) throw new Error("stills failed: " + (r.err || r.out).slice(-800));
    const sheet = path.join(work, "stills", "contact.png");
    if (!fs.existsSync(sheet)) throw new Error("contact sheet missing");
    step("vision-qa", "the brain looks at the contact sheet", 66);
    const verdict = await brainVision(
      "You are the QA step of a video editor. This contact sheet shows stills of motion graphics that will be overlaid on a talking-head video. Check STRICTLY for defects INSIDE the graphics layer: graphics text clipped by frame edges, graphics text overlapping other graphics text or the speaker's face (the speaker is visible in the footage/PiP), unreadably small type, empty/broken graphics frames, garbled characters. IMPORTANT: text that is part of the source footage itself (baked into the video frames, e.g. a nameplate or title in the original recording) is NOT a graphics defect — graphics may legitimately cover footage content. Ignore subjective taste. Reply ONLY JSON: {\"pass\": true} or {\"pass\": false, \"issues\": [\"<concrete issue at still t=…>\"]}",
      sheet, { timeout: 180000 });
    const v = parseJsonBlock(verdict);
    const pass = !v ? true : v.pass !== false && !(Array.isArray(v.issues) && v.issues.length);
    log(`vision QA round ${round}:`, v ? (pass ? "PASS" : JSON.stringify(v.issues).slice(0, 400)) : "no verdict — accepting");
    save({ visionQA: { round, pass, issues: v?.issues || [] } });
    if (pass) return;
    if (round === 3) { log("vision QA still failing after 3 rounds — shipping as-is"); return; }
    // brain fixes story.js with the issues, then the loop re-renders stills
    step("brain-fix", "brain fixes what the vision QA saw", 58);
    const cur = fs.readFileSync(path.join(work, "story.js"), "utf8");
    const inputs = storyInputs(spec);
    const fix = await brainText(
      "You fix motion-graphics story files. Return the COMPLETE corrected story.js source only — no fences, no prose.",
      `The vision QA of the rendered stills found these real defects:\n${JSON.stringify(v.issues || [], null, 1)}\n\nFix them in story.js. Keep everything else the same.\n\n=== STYLE RULES ===\n${inputs.styleMd}\n\n=== CURRENT story.js ===\n${cur}`,
      { timeout: 420000 });
    const code = String(fix || "").replace(/^```(?:javascript|js)?\s*/i, "").replace(/```\s*$/i, "").trim();
    if (code.includes("var EDIT")) fs.writeFileSync(path.join(work, "story.js"), code);
  }
}

// ---- step 7: final render ----
async function doFinal(spec) {
  step("render", "final render (graphics frames + mix) — this is the long part", 70);
  const r = await run(PY, ["video-editor/scripts/render.py", work, "--height", String(spec.height || 1080)], { timeout: 5400000, cwd: ROOT });
  if (r.code !== 0) throw new Error("render failed: " + (r.err || r.out).slice(-1000));
  const fin = lastJson(r.out);
  log("render done:", fin ? JSON.stringify(fin) : "");
  const finalPath = path.join(work, "final.mp4");
  if (!fs.existsSync(finalPath)) throw new Error("final.mp4 missing after render");
  // publish as an app asset (same layout src/lib/asset-dir.ts resolves to)
  const assets = path.join(ROOT, "db", "assets");
  fs.mkdirSync(assets, { recursive: true });
  const aid = crypto.randomBytes(10).toString("hex");
  fs.copyFileSync(finalPath, path.join(assets, aid + ".mp4"));
  const j = save({
    status: "done", progress: 100, step: "done", note: "",
    result: {
      url: `/api/asset/${aid}`,
      seconds: fin?.seconds ?? null, sfx_peak: fin?.sfx_peak ?? null,
      cutSummary: job().cutSummary || null, mistakeCuts: job().mistakeCuts || [], visionQA: job().visionQA || null,
      finishedAt: Date.now(),
    },
  });
  log("DONE →", j.result.url);
}

// ---- main ----
(async () => {
  const t0 = Date.now();
  save({ status: "running", startedAt: Date.now() });
  try {
    const spec = job();
    const style = STYLES.has(spec.style) ? spec.style : "warm-canvas";
    const video = path.join(dir, spec.videoFile || "src.mp4");
    if (!fs.existsSync(video)) throw new Error("source video missing: " + video);
    fs.mkdirSync(work, { recursive: true });
    await doTranscribe({ ...spec, video, lang: spec.lang });
    await doCuts(spec);
    await doCut({ ...spec, style });
    await doStory({ ...spec, style });
    await doVisionQA({ ...spec, style });
    await doFinal(spec);
    log("total", Math.round((Date.now() - t0) / 1000) + "s");
  } catch (e) {
    log("FAILED:", String(e).slice(0, 1500));
    save({ status: "error", error: String(e).slice(0, 1500), step: "error" });
    process.exit(1);
  }
})();

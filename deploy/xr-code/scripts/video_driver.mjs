// video_driver.mjs — advanced video generation ("any type of video").
//
// clip mode:  one 5s SDK video task → asset.
// story mode: the brain plans a storyboard (N self-contained scenes with
//             narration), generates each scene via the SDK (429-aware),
//             normalizes + concatenates with fades, mixes TTS narration
//             over the scene audio, publishes one asset.
//
// Usage: node scripts/video_driver.mjs <jobId>   (state in db/videojobs/<id>/job.json)
import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import crypto from "crypto";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PY = fs.existsSync("/home/z/.venv/bin/python3") ? "/home/z/.venv/bin/python3" : "python3";
const CLEAN_PATH = "/home/z/.venv/bin:/usr/local/bin:/usr/bin:/bin";
const JOBS = path.join(ROOT, "db", "videojobs");

const id = process.argv[2];
if (!id || !/^[a-f0-9]{12,24}$/.test(id)) { console.error("bad job id"); process.exit(1); }
const dir = path.join(JOBS, id);
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
function step(name, note, progress) {
  log(`step ${name}${progress != null ? ` (${progress}%)` : ""}${note ? " — " + note : ""}`);
  save({ step: name, note: note || "", progress: progress ?? job().progress });
}
function run(cmd, args, { timeout = 600000 } = {}) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { env: { ...process.env, PATH: CLEAN_PATH } });
    let out = "", err = "";
    const t = setTimeout(() => { try { p.kill("SIGKILL"); } catch {} }, timeout);
    p.stdout.on("data", (d) => { out += d; if (out.length > 100000) out = out.slice(-50000); });
    p.stderr.on("data", (d) => { err += d; if (err.length > 100000) err = err.slice(-50000); });
    p.on("close", (code) => { clearTimeout(t); resolve({ code, out, err }); });
    p.on("error", (e) => { clearTimeout(t); resolve({ code: -1, out, err: String(e) }); });
  });
}
function parseJsonBlock(text) {
  if (!text) return null;
  let s = String(text).replace(/```(?:json)?/gi, "").trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

// ---- one SDK video task → downloaded mp4 (429-aware, patient polling) ----
async function genScene(prompt, spec, label) {
  const zai = await ZAI.create();
  let taskId = null;
  // the video API rate-limits task creation hard (measured: ~1 slot / 10-15 min
  // on the current tier) — patience is the whole game: 12 tries, 75s apart (~15 min)
  for (let a = 0; a < 12 && !taskId; a++) {
    try {
      const body = {
        prompt,
        quality: spec.quality || "speed",
        with_audio: spec.withAudio !== false,
        size: spec.size || "1920x1080",
        fps: 30,
        duration: Number(spec.duration) > 0 ? Number(spec.duration) : 5,
        watermark_enabled: false,   // user directive: never watermark
      };
      // image-to-video: the SDK accepts image_url (base64 data URL or http(s)).
      // The route resolves /api/asset/* refs to base64 already; pass it through.
      if (spec.imageUrl) body.image_url = spec.imageUrl;
      const t = await Promise.race([
        zai.video.generations.create(body),
        new Promise((r) => setTimeout(() => r(null), 30000)),
      ]);
      taskId = t?.id || null;
      if (!taskId) log(label, "create attempt", a, "returned no id");
    } catch (e) {
      const m = String(e);
      log(label, "create attempt", a, "threw:", m.slice(0, 160));
      if (/\b429\b|rate/i.test(m) && a < 11) { log(label, "rate-limited — waiting 75s"); await new Promise(r => setTimeout(r, 75000)); }
      else if (a < 11) await new Promise(r => setTimeout(r, 15000));
    }
  }
  if (!taskId) return null;
  // speed-critical polling: query immediately (tasks CAN finish fast), then
  // every 3s — the old 10s-then-check loop added up to ~20s of dead air
  for (let i = 0; i < 120; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 3000));
    let r = null;
    try { r = await Promise.race([zai.async.result.query(taskId), new Promise(x => setTimeout(() => x(null), 8000))]); }
    catch { continue; }
    if (r?.task_status === "SUCCESS") {
      const url = r?.video_result?.[0]?.url;
      if (!url) return null;
      const res = await fetch(url);
      const buf = Buffer.from(await res.arrayBuffer());
      const f = path.join(dir, label + ".mp4");
      fs.writeFileSync(f, buf);
      log(label, "downloaded", (buf.length / 1048576).toFixed(1), "MB");
      return f;
    }
    if (r?.task_status === "FAIL") { log(label, "task FAIL"); return null; }
  }
  log(label, "polling window exhausted");
  return null;
}

// ---- brain storyboarding ----
async function planScenes(spec) {
  step("brain-plan", "the brain storyboards the video", 5);
  const dur = Number(spec.duration) > 0 ? Number(spec.duration) : 5;
  const sys = "You are a video director. You break one video idea into consecutive scenes for a text-to-video generator.";
  const user = `Video idea: ${spec.prompt}
Plan exactly ${spec.scenes} scenes. Rules:
- Each scene is ONE ${dur}-second shot. The scenes play back to back and must feel like ONE coherent video: same subject, same visual style, continuous story, no scene numbers or captions inside the picture.
- scene prompt: vivid cinematic English for the generator — subject, action, camera move, lighting, style. Max 60 words, self-contained (the generator only sees this one scene).
- narration: what the narrator says over this scene. Max 28 words, natural spoken sentence(s), continues the story. Empty string if the video needs no words.
- No on-screen text, no watermarks, no subtitles — generators render text badly.
Reply ONLY strict JSON: {"scenes":[{"prompt":"...","narration":"..."}]}`;
  const raw = await brainText(sys, user);
  const plan = parseJsonBlock(raw);
  const scenes = Array.isArray(plan?.scenes) ? plan.scenes.filter(s => s && s.prompt) : [];
  if (!scenes.length) throw new Error("brain produced no usable storyboard: " + String(raw).slice(0, 300));
  log("storyboard:", scenes.length, "scenes");
  save({ storyboard: scenes });
  return scenes;
}
async function brainText(sys, user, { model = "glm-4.6", timeout = 240000 } = {}) {
  const zai = await ZAI.create();
  const res = (await Promise.race([
    zai.chat.completions.create({ model, messages: [{ role: "system", content: sys }, { role: "user", content: user }] }),
    new Promise((r) => setTimeout(() => r(null), timeout)),
  ]));
  return String(res?.choices?.[0]?.message?.content || "").trim();
}

// ---- clip prompt polish: a short idea gets the director treatment, exactly
// like the storyboard path — action verb, camera move, lighting, style. Long
// detailed prompts are already directed and skip the LLM hop.
async function polishClip(prompt, dur) {
  if (String(prompt).length >= 200) return prompt;
  try {
    const sys = "You are a video director writing one shot prompt for a text-to-video generator.";
    const user = `Expand this video idea into ONE vivid ${dur}-second cinematic shot prompt: keep every fact of the idea, add the subject's action, one camera move, the setting, lighting and style. Max 60 words. No on-screen text, no watermarks. Reply with ONLY the prompt.\n\nIdea: ${prompt}`;
    const out = await brainText(sys, user, { timeout: 12000 });
    const clean = out.replace(/^["'`\s]+|["'`\s]+$/g, "");
    if (clean && clean.length > 20 && clean.length < 1200 && !/^[{\[]/.test(clean)) {
      log("clip-polish:", clean.slice(0, 100));
      return clean;
    }
  } catch (e) { /* fall through — never block the shot */ }
  log("clip-polish: kept raw prompt");
  return prompt;
}

// ---- ffmpeg assembly ----
async function assemble(files, spec, narrations) {
  step("assemble", "stitching scenes + mixdown", 82);
  const dur = Number(spec.duration) > 0 ? Number(spec.duration) : 5;
  const norm = [];
  for (let i = 0; i < files.length; i++) {
    const out = path.join(dir, `norm_${i}.mp4`);
    const r = await run("ffmpeg", ["-y", "-loglevel", "error", "-i", files[i],
      "-vf", `fade=t=in:st=0:d=0.25,fade=t=out:st=${Math.max(0, dur - 0.25)}:d=0.25,scale=` + (spec.size || "1920x1080").replace("x", ":") + ":force_original_aspect_ratio=increase,crop=" + (spec.size || "1920x1080").replace("x", ":"),
      "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-t", String(dur), out], { timeout: 300000 });
    if (r.code !== 0) throw new Error("normalize failed: " + r.err.slice(-300));
    norm.push(out);
  }
  const list = path.join(dir, "list.txt");
  fs.writeFileSync(list, norm.map(f => "file '" + f + "'").join("\n"));
  const concat = path.join(dir, "concat.mp4");
  const rc = await run("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", concat], { timeout: 300000 });
  if (rc.code !== 0) throw new Error("concat failed: " + rc.err.slice(-300));

  let final = concat;
  if (narrations && narrations.length) {
    // narration track: pad/trim each TTS to its scene's 5s, concat, mix over scene audio
    const wavs = [];
    for (let i = 0; i < narrations.length; i++) {
      const t = path.join(dir, `narr_raw_${i}.wav`);
      const r = await run("z-ai", ["tts", "-i", narrations[i], "-o", t, "--format", "wav"], { timeout: 120000 });
      if (r.code !== 0 || !fs.existsSync(t) || fs.statSync(t).size < 2000) { log("narration", i, "failed — continuing without it"); wavs.push(null); continue; }
      const std = path.join(dir, `narr_std_${i}.wav`);
      await run("ffmpeg", ["-y", "-loglevel", "error", "-i", t, "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", std]);
      const pad = path.join(dir, `narr_pad_${i}.wav`);
      await run("ffmpeg", ["-y", "-loglevel", "error", "-i", std, "-af", "apad", "-t", String(dur), pad]);
      wavs.push(pad);
    }
    if (wavs.some(Boolean)) {
      // a missing narration for a scene = <dur>s of silence, so the track stays aligned
      const sil = path.join(dir, "silence.wav");
      await run("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", `anullsrc=r=48000:cl=stereo`, "-t", String(dur), "-c:a", "pcm_s16le", sil]);
      const filled = wavs.map((f) => f || sil);
      const nlist = path.join(dir, "narr_list.txt");
      fs.writeFileSync(nlist, filled.map(f => "file '" + f + "'").join("\n"));
      const nfull = path.join(dir, "narration_full.wav");
      const rn = await run("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", nlist, "-c:a", "pcm_s16le", nfull], { timeout: 120000 });
      if (rn.code !== 0) throw new Error("narration concat failed: " + rn.err.slice(-300));
      const mixed = path.join(dir, "final.mp4");
      const rm = await run("ffmpeg", ["-y", "-loglevel", "error", "-i", concat, "-i", nfull,
        "-filter_complex", "[0:a]volume=0.25[bg];[bg][1:a]amix=inputs=2:duration=first:dropout_transition=0[a]",
        "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", mixed], { timeout: 300000 });
      if (rm.code !== 0) throw new Error("narration mix failed: " + rm.err.slice(-300));
      final = mixed;
      log("narration mixed over scene audio");
    }
  }
  return final;
}

function publish(final) {
  const assets = path.join(ROOT, "db", "assets");
  fs.mkdirSync(assets, { recursive: true });
  const aid = crypto.randomBytes(10).toString("hex");
  fs.copyFileSync(final, path.join(assets, aid + ".mp4"));
  save({ status: "done", progress: 100, step: "done", note: "", result: { url: `/api/asset/${aid}`, finishedAt: Date.now() } });
  log("DONE →", `/api/asset/${aid}`);
}

// ---- main ----
(async () => {
  save({ status: "running", startedAt: Date.now() });
  const t0 = Date.now();
  try {
    const spec = job();
    if (spec.mode === "story") {
      const scenes = await planScenes(spec);
      const files = [];
      for (let i = 0; i < scenes.length; i++) {
        step("scene", `generating scene ${i + 1}/${scenes.length}`, 12 + Math.round((i / scenes.length) * 68));
        const f = await genScene(String(scenes[i].prompt), spec, `scene_${i}`);
        if (f) files.push(f);
        else log("scene", i, "FAILED — skipping");
      }
      if (!files.length) throw new Error("every scene failed to generate");
      const narrations = spec.narrate ? scenes.slice(0, files.length).map(s => String(s.narration || "").trim()).filter(Boolean) : [];
      if (spec.narrate && narrations.length < files.length) log("note: some scenes have no narration — track padded");
      const final = await assemble(files, spec, narrations);
      publish(final);
    } else {
      step("clip", "generating the shot", 20);
      const polished = await polishClip(spec.prompt, Number(spec.duration) > 0 ? Number(spec.duration) : 5);
      if (polished !== spec.prompt) save({ polishedPrompt: polished });
      const f = await genScene(polished, spec, "clip");
      if (!f) throw new Error("video generation failed (see driver.log)");
      publish(f);
    }
    log("total", Math.round((Date.now() - t0) / 1000) + "s");
  } catch (e) {
    log("FAILED:", String(e).slice(0, 1200));
    save({ status: "error", error: String(e).slice(0, 1200), step: "error" });
    process.exit(1);
  }
})();

// Inline video generation — runs the same pipeline as scripts/video_driver.mjs
// but IN-PROCESS so it survives on Vercel's serverless runtime (the detached
// spawn() in the old driver dies when the route function returns).
//
// The route awaits runVideoJob(spec) which writes state to db/videojobs/<id>/
// and returns the final asset URL. The whole pipeline must finish inside the
// route's request timeout (~250s on Vercel Pro).
import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import crypto from "crypto";
import { assetDir } from "./asset-dir";

const ROOT = process.cwd();
const JOBS = path.join(ROOT, "db", "videojobs");
const CLEAN_PATH = "/home/z/.venv/bin:/usr/local/bin:/usr/bin:/bin";

export type VideoSpec = {
  id: string;
  mode: "clip" | "story";
  prompt: string;
  size: string;
  duration: number;
  withAudio: boolean;
  scenes: number;
  narrate: boolean;
  quality: "speed" | "quality";
  model?: string;    // arena-style engine pick ('auto' resolves server-side)
  imageUrl: string;  // base64 data URL or "" for text-to-video
  watermark: boolean;
};

function logLine(dir: string, line: string) {
  try { fs.appendFileSync(path.join(dir, "driver.log"), line + "\n"); } catch {}
}

function run(cmd: string, args: string[], { timeout = 300000 }: { timeout?: number } = {}): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { env: { ...process.env, PATH: CLEAN_PATH } });
    let out = "", err = "";
    const t = setTimeout(() => { try { p.kill("SIGKILL"); } catch {} }, timeout);
    p.stdout.on("data", (d) => { out += d; if (out.length > 100000) out = out.slice(-50000); });
    p.stderr.on("data", (d) => { err += d; if (err.length > 100000) err = out.slice(-50000); });
    p.on("close", (code) => { clearTimeout(t); resolve({ code, out, err }); });
    p.on("error", (e) => { clearTimeout(t); resolve({ code: -1, out, err: String(e) }); });
  });
}

function parseJsonBlock(text: string): any | null {
  if (!text) return null;
  let s = String(text).replace(/```(?:json)?/gi, "").trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

// one SDK video task → downloaded mp4 (429-aware, patient polling)
// The gateway exposes ONE concurrent video slot per account and maps every
// model name (seedance included) onto cogvideox-3 — parallel lane bursts only
// burn the rate limiter. What actually works: ONE create attempt per round,
// retried patiently until the deadline, then a long poll.
async function genScene(spec: VideoSpec, prompt: string, dir: string, label: string, log: (s: string) => void): Promise<{ file: string; engine: string } | null> {
  const zai = await ZAI.create();
  const body: any = {
    prompt,
    model: spec.model || "cogvideox-3",   // arena-style pick; gateway maps unknowns to its engine
    quality: spec.quality || "speed",
    with_audio: spec.withAudio !== false,
    size: spec.size || "1920x1080",
    fps: 30,
    duration: spec.duration > 0 ? spec.duration : 5,
    watermark_enabled: false,
  };
  if (spec.imageUrl) body.image_url = spec.imageUrl;

  const createDeadline = Date.now() + 60000;   // up to 60s to land a free slot
  let taskId: string | null = null;
  let engineActual = spec.model || "cogvideox-3";
  let round = 0;
  while (!taskId && Date.now() < createDeadline) {
    round++;
    try {
      const t = await Promise.race([
        zai.video.generations.create({ ...body, request_id: crypto.randomBytes(8).toString("hex") }),
        new Promise((r) => setTimeout(() => r(null), 25000)),
      ]);
      taskId = (t as any)?.id || null;
      if (taskId) {
        // report the engine the gateway ACTUALLY used (it may remap the pick)
        engineActual = String((t as any)?.model || body.model);
        break;
      }
    } catch (e) {
      const m = String(e);
      if (!/\b429\b|rate/i.test(m)) log(`create round ${round} threw: ${m.slice(0, 100)}`);
    }
    const left = createDeadline - Date.now();
    if (left > 0) await new Promise(r => setTimeout(r, Math.min(10000, left)));
  }
  if (!taskId) { log(`no free slot within 60s`); return null; }
  const engine = engineActual;
  log(`task created after ${round} round(s): ${taskId}`);
  saveEngine(dir, engine);
  for (let i = 0; i < 70; i++) {  // 70 × 3s = 210s max polling (~3.5 min)
    if (i > 0) await new Promise(r => setTimeout(r, 3000));
    let r: any = null;
    try { r = await Promise.race([zai.async.result.query(taskId), new Promise(x => setTimeout(() => x(null), 8000))]); }
    catch { continue; }
    if (r?.task_status === "SUCCESS") {
      const url = r?.video_result?.[0]?.url;
      if (!url) return null;
      const res = await fetch(url);
      const buf = Buffer.from(await res.arrayBuffer());
      const f = path.join(dir, label + ".mp4");
      fs.writeFileSync(f, buf);
      log(`downloaded ${(buf.length / 1048576).toFixed(1)} MB`);
      return { file: f, engine };
    }
    if (r?.task_status === "FAIL") { log(`task FAIL`); return null; }
  }
  log(`polling window exhausted`);
  return null;
}

function saveEngine(dir: string, engine: string) {
  try {
    const jp = path.join(dir, "job.json");
    const j = JSON.parse(fs.readFileSync(jp, "utf8"));
    fs.writeFileSync(jp, JSON.stringify({ ...j, engine }));
  } catch { /* job.json missing — cosmetic only */ }
}

async function brainText(sys: string, user: string, timeout = 60000): Promise<string> {
  const zai = await ZAI.create();
  const res = await Promise.race([
    zai.chat.completions.create({ model: "glm-4.5-flash", messages: [{ role: "system", content: sys }, { role: "user", content: user }] }),
    new Promise((r) => setTimeout(() => r(null), timeout)),
  ]);
  return String((res as any)?.choices?.[0]?.message?.content || "").trim();
}

async function polishClip(prompt: string, dur: number, log: (s: string) => void): Promise<string> {
  if (String(prompt).length >= 200) return prompt;
  try {
    const sys = "You are a video director writing one shot prompt for a text-to-video generator.";
    const user = `Expand this video idea into ONE vivid ${dur}-second cinematic shot prompt: keep every fact of the idea, add the subject's action, one camera move, the setting, lighting and style. Max 60 words. No on-screen text, no watermarks. Reply with ONLY the prompt.\n\nIdea: ${prompt}`;
    const out = await brainText(sys, user, 12000);
    const clean = out.replace(/^["'`\s]+|["'`\s]+$/g, "");
    if (clean && clean.length > 20 && clean.length < 1200 && !/^[{\[]/.test(clean)) {
      log(`clip-polish: ${clean.slice(0, 80)}`);
      return clean;
    }
  } catch { /* fall through */ }
  return prompt;
}

async function assemble(files: string[], spec: VideoSpec, dir: string, log: (s: string) => void): Promise<string> {
  const dur = spec.duration > 0 ? spec.duration : 5;
  const norm: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const out = path.join(dir, `norm_${i}.mp4`);
    const r = await run("ffmpeg", ["-y", "-loglevel", "error", "-i", files[i],
      "-vf", `fade=t=in:st=0:d=0.25,fade=t=out:st=${Math.max(0, dur - 0.25)}:d=0.25,scale=${(spec.size || "1920x1080").replace("x", ":")}:force_original_aspect_ratio=increase,crop=${(spec.size || "1920x1080").replace("x", ":")}`,
      "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-t", String(dur), out], { timeout: 120000 });
    if (r.code !== 0) throw new Error("normalize failed: " + r.err.slice(-300));
    norm.push(out);
  }
  if (norm.length === 1) return norm[0];
  const list = path.join(dir, "list.txt");
  fs.writeFileSync(list, norm.map(f => "file '" + f + "'").join("\n"));
  const concat = path.join(dir, "concat.mp4");
  const rc = await run("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", concat], { timeout: 120000 });
  if (rc.code !== 0) throw new Error("concat failed: " + rc.err.slice(-300));
  return concat;
}

function publish(final: string): string {
  const assets = assetDir();
  fs.mkdirSync(assets, { recursive: true });
  const aid = crypto.randomBytes(10).toString("hex");
  fs.copyFileSync(final, path.join(assets, aid + ".mp4"));
  return `/api/asset/${aid}`;
}

// Main entry — runs inline, returns the asset URL or throws.
export async function runVideoJob(spec: VideoSpec): Promise<{ url: string; engine: string; polishedPrompt?: string }> {
  const dir = path.join(JOBS, spec.id);
  fs.mkdirSync(dir, { recursive: true });
  const log = (s: string) => { logLine(dir, `[${new Date().toISOString().slice(11, 19)}] ${s}`); };
  const jobPath = path.join(dir, "job.json");
  const save = (patch: any) => {
    const j = { ...JSON.parse(fs.readFileSync(jobPath, "utf8")), ...patch, updatedAt: Date.now() };
    fs.writeFileSync(jobPath, JSON.stringify(j));
    return j;
  };
  save({ status: "running", startedAt: Date.now() });
  log(`start: mode=${spec.mode} prompt=${spec.prompt.slice(0, 60)} dur=${spec.duration}`);

  if (spec.mode === "story") {
    // story mode is too long for inline — fall back to single clip
    log("story mode too long for inline — using clip");
  }
  save({ step: "clip", note: "generating the shot", progress: 20 });
  const polished = await polishClip(spec.prompt, spec.duration, log);
  if (polished !== spec.prompt) save({ polishedPrompt: polished });
  const gen = await genScene(spec, polished, dir, "clip", log);
  if (!gen) throw new Error("video generation failed");
  save({ step: "assemble", note: "stitching", progress: 82 });
  const final = await assemble([gen.file], spec, dir, log);
  const url = publish(final);
  save({ status: "done", progress: 100, step: "done", note: "", result: { url, finishedAt: Date.now() } });
  log(`DONE → ${url}`);
  return { url, engine: gen.engine, polishedPrompt: polished !== spec.prompt ? polished : undefined };
}

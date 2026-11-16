import { NextResponse } from "next/server";
import { verifyDiscord } from "../../../lib/xrauth";

// POST /api/video — advanced video generation, any type of video.
//   mode "clip"  { prompt, size?, withAudio?, quality? }   → one 5s shot
//   mode "story" { prompt, scenes?, size?, withAudio?, narrate? } → the brain
//     storyboards 2-6 scenes, generates each, concatenates with transitions,
//     optional TTS narration mixed over the scene audio.
// → { ok, id, status: "/api/video?id=<id>" }; the driver runs detached and
//   all state is on disk (db/videojobs/<id>/job.json).
// GET /api/video?id=<id> → { ok, job } live progress.
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";

const ROOT = process.cwd();
const JOBS = path.join(ROOT, "db", "videojobs");
const SIZES = new Set(["1920x1080", "1080x1920", "1024x1024"]);

export async function POST(req: Request) {
  const gv = verifyDiscord(req);
  if (!gv.ok)
    return NextResponse.json({ ok: false, error: "auth", auth: gv.error }, { status: 401 });
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const prompt = String(body?.prompt || "").trim();
    if (prompt.length < 3) return NextResponse.json({ ok: false, error: "no prompt" }, { status: 400 });
    const mode = body?.mode === "story" ? "story" : "clip";
    const size = SIZES.has(String(body?.size || "")) ? String(body?.size) : "1920x1080";
    const withAudio = body?.withAudio !== false; // default on
    const scenes = Math.max(2, Math.min(6, Number(body?.scenes) || 3));
    const narrate = body?.narrate === true; // story mode: TTS narration over the scenes
    const quality = body?.quality === "quality" ? "quality" : "speed";

    const id = crypto.randomBytes(10).toString("hex");
    const dir = path.join(JOBS, id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "job.json"), JSON.stringify({
      id, status: "queued", step: "queued", note: "", progress: 0,
      mode, prompt: prompt.slice(0, 2000), size, withAudio, scenes, narrate, quality,
      createdAt: Date.now(),
    }));
    const child = spawn(process.execPath, ["scripts/video_driver.mjs", id], {
      cwd: ROOT, detached: true, stdio: "ignore", env: process.env,
    });
    child.unref();
    return NextResponse.json({ ok: true, id, status: "/api/video?id=" + id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "bad request: " + String(e).slice(0, 160) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const gv = verifyDiscord(req);
  if (!gv.ok)
    return NextResponse.json({ ok: false, error: "auth", auth: gv.error }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[a-f0-9]{16,24}$/.test(id))
    return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });
  try {
    const j = JSON.parse(fs.readFileSync(path.join(JOBS, id, "job.json"), "utf8"));
    return NextResponse.json({ ok: true, job: j });
  } catch {
    return NextResponse.json({ ok: false, error: "no such job" }, { status: 404 });
  }
}

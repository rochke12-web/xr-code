import { NextResponse } from "next/server";
import { verifyRequest } from "../../../lib/request-auth";
import { mediaOverLimit, addMedia } from "../../../lib/xrstore";

// POST /api/video — advanced video generation, any type of video.
//   mode "clip"  { prompt, size?, withAudio?, quality?, duration?, image_url?, narrate? }
//     → one shot (10s default), optional image-to-video + TTS narration
//   mode "story" { prompt, scenes?, size?, withAudio?, narrate? }
//     → the brain storyboards 2-6 scenes, generates each, concatenates with
//     transitions, optional TTS narration mixed over scene audio.
// → { ok, id, status: "/api/video?id=<id>" }; the driver runs detached and
//   all state is on disk (db/videojobs/<id>/job.json).
// GET /api/video?id=<id> → { ok, job } live progress.
//
// Free tier: 3 videos/day per Google account (mediaOverLimit). The cap is
// checked BEFORE the job starts so a dry bucket burns no SDK calls; the
// counter is incremented when the job is queued (a failed generation still
// counts — the model slot was spent).
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";

const ROOT = process.cwd();
const JOBS = path.join(ROOT, "db", "videojobs");
const SIZES = new Set(["1920x1080", "1080x1920", "1024x1024"]);
const DURATIONS = new Set([5, 10]);
const OUTAGE_TEXT =
  "You've used today's 3-video allowance for this account — it resets at 00:00 UTC. " +
  "Your existing videos are safe; come back tomorrow for more.";

export async function POST(req: Request) {
  const gv = await verifyRequest(req);
  if (!gv.ok)
    return NextResponse.json({ ok: false, error: "auth", auth: gv.error }, { status: 401 });
  const uid = gv.uid || "";

  // ---- free-tier quota gate (3 videos / day / Google account) ----
  const q = await mediaOverLimit(uid, "video");
  if (q.over) {
    return NextResponse.json({
      ok: true,
      limit: true,
      engine: "xr-code",
      text: OUTAGE_TEXT,
      usage: { used: q.used, limit: q.limit, day: q.day },
    });
  }

  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const prompt = String(body?.prompt || "").trim();
    if (prompt.length < 3) return NextResponse.json({ ok: false, error: "no prompt" }, { status: 400 });
    const mode = body?.mode === "story" ? "story" : "clip";

    // image-to-video: accept a base64 data URL or an /api/asset/<id> reference.
    // The driver passes it straight to the SDK as image_url (clip mode only).
    let imageUrl: string | null = null;
    if (mode === "clip" && typeof body?.image_url === "string") {
      const ref = body.image_url.trim().slice(0, 8_000_000);
      if (ref.startsWith("data:image/")) {
        imageUrl = ref;
      } else if (ref.startsWith("/api/asset/")) {
        // resolve a stored asset to a base64 data URL the SDK accepts
        try {
          const aid = ref.slice("/api/asset/".length).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
          const ap = path.join(ROOT, "db", "assets", aid + ".jpg");
          const apPng = path.join(ROOT, "db", "assets", aid + ".png");
          const apath = fs.existsSync(ap) ? ap : fs.existsSync(apPng) ? apPng : "";
          if (apath) {
            const buf = fs.readFileSync(apath);
            const ext = path.extname(apath).slice(1).toLowerCase();
            const mime = ext === "png" ? "image/png" : "image/jpeg";
            imageUrl = `data:${mime};base64,${buf.toString("base64")}`;
          }
        } catch {
          /* bad asset ref — ignore, generate text-to-video */
        }
      }
    }

    const size = SIZES.has(String(body?.size || "")) ? String(body?.size) : "1920x1080";
    const duration =
      DURATIONS.has(Number(body?.duration)) ? Number(body?.duration) : 10; // 10s default per user directive
    // story mode keeps the audio bed (narration mixing needs [0:a]); clip mode
    // defaults silent unless asked — audio synthesis adds real render time.
    const withAudio = mode === "story" ? body?.withAudio !== false : body?.withAudio === true;
    const scenes = Math.max(2, Math.min(6, Number(body?.scenes) || 3));
    const narrate = body?.narrate === true; // TTS narration over the scenes
    const quality = body?.quality === "quality" ? "quality" : "speed";

    const id = crypto.randomBytes(10).toString("hex");
    const dir = path.join(JOBS, id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "job.json"), JSON.stringify({
      id, status: "queued", step: "queued", note: "", progress: 0,
      mode, prompt: prompt.slice(0, 2000), size, duration, withAudio, scenes, narrate, quality,
      imageUrl: imageUrl || "",  // base64 data URL or "" for text-to-video
      watermark: false,          // user directive: no watermark
      createdAt: Date.now(),
    }));

    // count this video against the account's daily cap BEFORE the driver runs,
    // so a flood of parallel requests can't slip past the gate.
    await addMedia(uid, "videos", 1);

    const child = spawn(process.execPath, ["scripts/video_driver.mjs", id], {
      cwd: ROOT, detached: true, stdio: "ignore", env: process.env,
    });
    child.unref();
    return NextResponse.json({
      ok: true,
      id,
      status: "/api/video?id=" + id,
      usage: { used: q.used + 1, limit: q.limit, day: q.day },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "bad request: " + String(e).slice(0, 160) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const gv = await verifyRequest(req);
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

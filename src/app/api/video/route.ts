import { NextResponse } from "next/server";
import { verifyRequest } from "../../../lib/request-auth";
import { mediaOverLimit, addMedia } from "../../../lib/xrstore";
import { runVideoJob } from "../../../lib/video-inline";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// POST /api/video — inline video generation (runs in-process so it survives on
// Vercel serverless — the old detached spawn() died when the function returned).
// The route long-polls the SDK pipeline inline (up to ~240s) and returns the
// final mp4 URL in the same response. The client just waits.
//   { prompt, size?, withAudio?, quality?, duration?, image_url?, narrate? }
//
// Free tier: 3 videos/day per Google account (mediaOverLimit). Counted when the
// job starts — a failed generation still counts (the model slot was spent).
const ROOT = process.cwd();
const JOBS = path.join(ROOT, "db", "videojobs");
const SIZES = new Set(["1920x1080", "1080x1920", "1024x1024"]);
const DURATIONS = new Set([5, 10]);
const OUTAGE_TEXT =
  "You've used today's 3-video allowance for this account — it resets at 00:00 UTC.";

export async function POST(req: Request) {
  const gv = await verifyRequest(req);
  if (!gv.ok)
    return NextResponse.json({ ok: false, error: "auth", auth: gv.error }, { status: 401 });
  const uid = gv.uid || "";

  const q = await mediaOverLimit(uid, "video");
  if (q.over) {
    return NextResponse.json({
      ok: true, limit: true, engine: "xr-code", text: OUTAGE_TEXT,
      usage: { used: q.used, limit: q.limit, day: q.day },
    });
  }

  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const prompt = String(body?.prompt || "").trim();
    if (prompt.length < 3) return NextResponse.json({ ok: false, error: "no prompt" }, { status: 400 });

    // image-to-video: resolve /api/asset/* refs to base64 data URLs
    let imageUrl = "";
    if (typeof body?.image_url === "string") {
      const ref = body.image_url.trim().slice(0, 8_000_000);
      if (ref.startsWith("data:image/")) imageUrl = ref;
      else if (ref.startsWith("/api/asset/")) {
        try {
          const aid = ref.slice("/api/asset/".length).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
          const ap = path.join(ROOT, "db", "assets", aid + ".jpg");
          const apPng = path.join(ROOT, "db", "assets", aid + ".png");
          const apath = fs.existsSync(ap) ? ap : fs.existsSync(apPng) ? apPng : "";
          if (apath) {
            const buf = fs.readFileSync(apath);
            const ext = path.extname(apath).slice(1).toLowerCase();
            imageUrl = `data:${ext === "png" ? "image/png" : "image/jpeg"};base64,${buf.toString("base64")}`;
          }
        } catch { /* ignore — text-to-video */ }
      }
    }

    const size = SIZES.has(String(body?.size || "")) ? String(body?.size) : "1920x1080";
    const duration = DURATIONS.has(Number(body?.duration)) ? Number(body?.duration) : 10;
    const withAudio = body?.withAudio === true;
    const narrate = body?.narrate === true;
    const quality = body?.quality === "quality" ? "quality" : "speed";

    const id = crypto.randomBytes(10).toString("hex");
    const dir = path.join(JOBS, id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "job.json"), JSON.stringify({
      id, status: "queued", step: "queued", note: "", progress: 0,
      mode: "clip", prompt: prompt.slice(0, 2000), size, duration, withAudio, scenes: 1,
      narrate, quality, imageUrl, watermark: false, createdAt: Date.now(),
    }));

    await addMedia(uid, "videos", 1);

    // RUN INLINE — long-poll up to 240s. On Vercel Pro the function timeout is
    // 300s, so this fits. The client gets the final URL in the same response.
    try {
      const { url, engine } = await runVideoJob({
        id, mode: "clip", prompt: prompt.slice(0, 2000), size, duration,
        withAudio, scenes: 1, narrate, quality, imageUrl, watermark: false,
      });
      return NextResponse.json({
        ok: true, id, url, engine,
        usage: { used: q.used + 1, limit: q.limit, day: q.day },
      });
    } catch (e) {
      const err = String((e as Error)?.message || e).slice(0, 300);
      try {
        const jp = path.join(dir, "job.json");
        const j = JSON.parse(fs.readFileSync(jp, "utf8"));
        fs.writeFileSync(jp, JSON.stringify({ ...j, status: "error", error: err, step: "error" }));
      } catch {}
      return NextResponse.json({ ok: false, error: err, id }, { status: 502 });
    }
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

import { NextResponse } from "next/server";
import { verifyRequest } from "../../../lib/request-auth";
import { mediaOverLimit, addMedia } from "../../../lib/xrstore";
import { runVideoJob } from "../../../lib/video-inline";
import { ON_VERCEL, saveAssetBytes } from "../../../lib/asset-store";
import fs from "fs";
import path from "path";
import os from "os";
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
// job scratch must be writable — Vercel's FS is read-only outside /tmp
const JOBS = ON_VERCEL ? path.join(os.tmpdir(), "videojobs") : path.join(ROOT, "db", "videojobs");
const SIZES = new Set(["1920x1080", "1080x1920", "1024x1024"]);
const DURATIONS = new Set([5, 10]);
const OUTAGE_TEXT =
  "You've used today's 3-video allowance for this account — it resets at 00:00 UTC.";

// Pollinations studio lane — the ONLY video engine reachable from Vercel (the
// z.ai gateway host is a network wall from AWS egress, UND_ERR_CONNECT_TIMEOUT).
// gen.pollinations.ai has no anonymous video tier, so this lane needs an sk_
// key (prepaid pollen, from ~$0.01: enter.pollinations.ai/keys) set as
// POLLINATIONS_KEY. Flow: start the job with Prefer: respond-async (202, job
// lives on THEIR side — nothing to hold on the serverless FS), hand the job id
// to the client, and the client polls GET /api/video?pl=1&id=… until the mp4
// lands. Every hop is short → fits any function timeout.
const PL_KEY = () => process.env.POLLINATIONS_KEY || "";
const PL_BASE = "https://gen.pollinations.ai";
const PL_HEADERS = (key: string): Record<string, string> => ({
  authorization: `Bearer ${key}`,
  Referer: "https://xr-code.vercel.app",
});

async function plStart(prompt: string, model: string): Promise<{ jobId?: string; bytes?: Buffer; err?: string }> {
  const q = "model=" + encodeURIComponent(model) + "&duration=5";
  try {
    const r = await Promise.race([
      fetch(`${PL_BASE}/video/${encodeURIComponent(prompt.slice(0, 900))}?${q}`, {
        headers: { ...PL_HEADERS(PL_KEY()), Prefer: "respond-async" },
        signal: AbortSignal.timeout(25000),
      }),
      withJail(28000),
    ]) as Response | null;
    if (!r) return { err: "start timeout" };
    if (r.status === 200) {
      // cached / instant — the bytes are the mp4 itself
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 10000 && /^video\//.test(r.headers.get("content-type") || "")) return { bytes: buf };
      return { err: "start returned non-video" };
    }
    if (r.status === 202) {
      const j = (await r.json().catch(() => null)) as { id?: string } | null;
      const loc = r.headers.get("location") || "";
      const jobId = j?.id || loc.split("/").pop() || "";
      if (jobId) return { jobId };
      return { err: "start returned no job id" };
    }
    return { err: `start status ${r.status}` };
  } catch (e) {
    return { err: String((e as Error)?.message || e).slice(0, 120) };
  }
}

function withJail(ms: number): Promise<null> {
  return new Promise(r => setTimeout(() => r(null), ms));
}

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

    // arena-style model pick — 'auto' resolves to the gateway's real engine;
    // anything else passes through (the gateway maps unknown names to its engine)
    const reqModel = /^[A-Za-z0-9._/-]{1,60}$/.test(String(body?.model || "")) ? String(body?.model) : "auto";
    const model = reqModel === "auto" ? "cogvideox-3" : reqModel;

    // ---- studio lane first: pollinations async video (works from Vercel) ----
    if (PL_KEY()) {
      const arenaModel = reqModel === "auto"
        ? "x-ai/grok-imagine-video-1.5" // arena free-tier #1 (score 1488)
        : (reqModel.includes("/") ? reqModel : "x-ai/" + reqModel);
      const start = await plStart(prompt, arenaModel);
      if (start.bytes) {
        const url = await saveAssetBytes(start.bytes, "video/mp4");
        const usage = await addMedia(uid, "videos", 1); // counted only on success
        return NextResponse.json({ ok: true, url, engine: "pollinations-studio", usage: { used: usage.videos, limit: q.limit, day: usage.day } });      }
      if (start.jobId) {
        // the render lives on the studio's side — the client polls ?pl=1&id=…
        return NextResponse.json({ ok: true, pending: true, jobId: start.jobId, engine: "pollinations-studio" });
      }
      console.error("[video] studio lane failed:", start.err, "— falling to gateway");
      if (ON_VERCEL) {
        // the gateway below is a network wall from Vercel — fail clean and fast
        return NextResponse.json({ ok: false, nokey: true, error: "studio lane: " + start.err }, { status: 502 });
      }
    } else if (ON_VERCEL) {
      // no key on Vercel: every video lane is unreachable — say so in ms
      return NextResponse.json({
        ok: false, nokey: true,
        error: "The film studio needs a key — the engine moved to a new studio host. Images still work.",
      }, { status: 503 });
    }

    const size = SIZES.has(String(body?.size || "")) ? String(body?.size) : "1280x720";
    // 5s/720p finishes in ~155s — fits the 300s function cap. 10s/1080p runs 300s+
    // and dies mid-render, so it stays selectable but is NOT the default.
    const duration = DURATIONS.has(Number(body?.duration)) ? Number(body?.duration) : 5;
    const withAudio = body?.withAudio === true;
    const narrate = body?.narrate === true;
    const quality = body?.quality === "quality" ? "quality" : "speed";

    const id = crypto.randomBytes(10).toString("hex");
    const dir = path.join(JOBS, id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "job.json"), JSON.stringify({
      id, status: "queued", step: "queued", note: "", progress: 0,
      mode: "clip", prompt: prompt.slice(0, 2000), size, duration, withAudio, scenes: 1,
      narrate, quality, model, imageUrl, watermark: false, createdAt: Date.now(),
    }));

    await addMedia(uid, "videos", 1);

    // RUN INLINE — long-poll up to 240s. On Vercel Pro the function timeout is
    // 300s, so this fits. The client gets the final URL in the same response.
    try {
      const { url, engine } = await runVideoJob({
        id, mode: "clip", prompt: prompt.slice(0, 2000), size, duration,
        withAudio, scenes: 1, narrate, quality, imageUrl, watermark: false, model,
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
  const uid = gv.uid || "";
  const url = new URL(req.url);

  // pollinations studio job — poll THEIR result endpoint (the render lives on
  // their side). When the mp4 has landed: store it (Firestore-chunked on
  // Vercel) and only then count it against the daily allowance.
  if (url.searchParams.get("pl") === "1") {
    const plid = url.searchParams.get("id") || "";
    if (!/^[A-Za-z0-9._-]{6,80}$/.test(plid) || !PL_KEY())
      return NextResponse.json({ ok: false, error: "bad studio job" }, { status: 400 });
    try {
      const r = await fetch(`${PL_BASE}/v1/jobs/${plid}/result`, {
        headers: PL_HEADERS(PL_KEY()), redirect: "follow", signal: AbortSignal.timeout(15000),
      });
      if (r.status === 200 && /^video\//.test(r.headers.get("content-type") || "")) {
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length < 10000) return NextResponse.json({ ok: true, pending: true, jobId: plid });
        const save = await saveAssetBytes(buf, "video/mp4");
        const usage = await addMedia(uid, "videos", 1).catch(() => null);
        return NextResponse.json({
          ok: true, url: save, engine: "pollinations-studio",
          usage: usage ? { used: usage.videos, day: usage.day } : undefined,
        });
      }
      const j = (await r.json().catch(() => null)) as { status?: string; state?: string } | null;
      return NextResponse.json({ ok: true, pending: true, jobId: plid, status: j?.status || j?.state || r.status });
    } catch (e) {
      // a poll blip must never kill the job — the client just tries again
      return NextResponse.json({ ok: true, pending: true, jobId: plid, note: String((e as Error)?.message || e).slice(0, 80) });
    }
  }

  const id = url.searchParams.get("id") || "";
  if (!/^[a-f0-9]{16,24}$/.test(id))
    return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });
  try {
    const j = JSON.parse(fs.readFileSync(path.join(JOBS, id, "job.json"), "utf8"));
    return NextResponse.json({ ok: true, job: j });
  } catch {
    return NextResponse.json({ ok: false, error: "no such job" }, { status: 404 });
  }
}

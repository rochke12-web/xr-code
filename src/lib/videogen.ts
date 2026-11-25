// Video factory — split for serverless. A 5s AI render takes 1-6 minutes,
// far past Vercel's 60s function kill: the old inline poll loop (120 × 3s)
// got every real render 502'd, and the client answered with a "busy ·
// retrying…" loop. Now the chat POST only CREATES the task (≤30s) and hands
// back a job ticket; /api/video-status does ONE query per call and ships the
// provider URL when the clip lands (provider URLs stream direct — no storage,
// Firestore's 1 MiB doc cap could never hold a video anyway).
import ZAI from "z-ai-web-dev-sdk";
import { createZai } from "./zai-config";
import { mediaOverLimit, addMedia } from "./xrstore";

let ZAI_DEAD = false;
async function getZAI(): Promise<InstanceType<typeof ZAI.create> | null> {
  if (ZAI_DEAD) return null;
  try {
    return await createZai();
  } catch (e) {
    if (/configuration file not found|\.z-ai-config|not configured/i.test(String((e as Error)?.message || e))) ZAI_DEAD = true;
    return null;
  }
}

// VIDEO_MODEL ladder — free-tier video models from the arena leaderboard
// (2026-11-22), best score first; the gateway default is the proven last rung.
const VIDEO_MODELS: (string | undefined)[] = [
  "grok-imagine-video-1.5",
  "skyreels-v4",
  "muse-video",
  "happyhorse-1.0",
  "veo-3-fast",
  undefined,
];

// create the render task — walk the model ladder; every hop bounded at 30s so
// the POST always exits inside the function window. Rate-limited → an honest
// "busy" line instead of the old 45s sleep (which also blew the window).
export async function startVideoGen(
  prompt: string,
  withAudio: boolean,
  pick: string | undefined,
  uid: string,
  unlimited = false
): Promise<{ tid?: string; limit?: string } | null> {
  try {
    // free-tier gate — 3 videos/day per account, counted only on SUCCESS
    const q = unlimited ? { over: false, used: 0, limit: 0, day: "" } : await mediaOverLimit(uid, "video");
    if (q.over) {
      return { limit: `You've used all ${q.limit} free videos for today on this account — it resets at 00:00 UTC. Images are still open (10/day), and your chats are safe.` };
    }
    const ladder: (string | undefined)[] = pick && pick !== "auto" ? [pick, undefined] : VIDEO_MODELS;
    for (const m of ladder) {
      try {
        const zai = await getZAI();
        if (!zai) return null;
        const body: Record<string, unknown> = {
          prompt,
          quality: "speed",
          with_audio: withAudio,
          size: "1920x1080",
          fps: 30,
          duration: 5,
        };
        if (m) body.model = m;
        const task = (await Promise.race([
          zai.video.generations.create(body as Parameters<typeof zai.video.generations.create>[0]),
          new Promise<null>(r => setTimeout(() => r(null), 30000)),
        ])) as { id?: string } | null;
        if (task?.id) return { tid: task.id };
      } catch (e) {
        const msg = String(e);
        console.error("[videogen] create", m || "default", "threw:", msg.slice(0, 160));
        if (/fetch failed|UND_ERR_CONNECT|ECONNREFUSED|ETIMEDOUT/i.test(msg)) {
          ZAI_DEAD = true; // gateway host unreachable — skip all gateway rungs instantly
          return null;
        }
        if (msg.includes("429")) {
          return { limit: "The video engines are rate-limited right now — give it a minute and ask again." };
        }
        break; // invalid model / hard error → next rung of the ladder
      }
    }
    return null;
  } catch (e) {
    console.error("[videogen] start error:", String(e).slice(0, 160));
    return null;
  }
}

// ONE poll per call (8s cap) — the client drives the retry cadence.
export async function pollVideoGen(
  tid: string,
  uid: string
): Promise<{ done?: boolean; failed?: boolean; url?: string; cover?: string; error?: string }> {
  const zai = await getZAI();
  if (!zai) return { error: "engine" };
  let r: { task_status?: string; video_result?: { url?: string; cover_image_url?: string }[] } | null = null;
  for (let q = 0; q < 2 && !r; q++) {
    try {
      r = (await Promise.race([
        zai.async.result.query(tid),
        new Promise<null>(x => setTimeout(() => x(null), 8000)),
      ])) as typeof r;
    } catch (e) {
      console.error("[videogen] query threw:", String(e).slice(0, 140));
    }
  }
  if (!r) return {}; // a blip reads as still-rendering — the client keeps polling
  if (r.task_status === "SUCCESS") {
    const url = r.video_result?.[0]?.url;
    if (!url) return { done: true, failed: true };
    try { await addMedia(uid, "videos", 1); } catch { /* quota store hiccup never eats the video */ }
    return { done: true, url, cover: r.video_result?.[0]?.cover_image_url };
  }
  if (r.task_status === "FAIL") return { done: true, failed: true };
  return {}; // still rendering
}

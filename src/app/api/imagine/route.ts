import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { verifyRequest } from "../../../lib/request-auth";
import { mediaOverLimit, addMedia } from "../../../lib/xrstore";
import { saveAsset } from "../../../lib/asset-store";

// explicit Vercel budget — Hobby caps at 60s; without this export the
// platform default can be shorter and the paint race dies mid-flight
export const maxDuration = 60;

// XR-Code Imagine — the built-in image generator (NoteGPT-style).
// Pipeline: user idea → Kimi AI (kimi-k2) rewrites it into one vivid English
// image prompt → Gemini 3 Pro Image ("nano banana pro") paints it.
// Fallbacks: enhancer rides kimi → glm-4.5-flash → dpsk-4.1-flash → glm-4.6;
// painter rides gemini-3-pro-image-preview → gemini-2.5-flash-image (nano
// banana) → the gateway default painter. Everything server-side, no keys in
// the client.
// GET  /api/imagine → health probe { ok: true }
// POST /api/imagine { prompt, style?, size? } → { ok, url, enhanced, model, ms }

// style presets — prompt suffixes (client shows the same list as chips)
const STYLES: Record<string, string> = {
  auto: "",
  photoreal:
    "ultra-realistic photography, natural light, true-to-life textures, shot on a full-frame camera, 50mm lens, shallow depth of field",
  anime: "modern anime illustration, crisp line art, vibrant cel shading, expressive characters, studio-quality key visual",
  cinematic:
    "cinematic film still, dramatic volumetric lighting, anamorphic composition, rich color grading, epic atmosphere",
  digital: "polished digital painting, bold brushwork, dynamic composition, trending on ArtStation",
  render3d: "high-end 3D render, soft studio lighting, physically based materials, subsurface scattering, octane quality",
  watercolor: "delicate watercolor painting, soft pigment bleeds, textured paper, airy negative space",
  pixel: "clean pixel art, limited palette, crisp dithering, charming retro game aesthetic",
};

// painter sizes — every value fits BOTH the SDK whitelist AND the nano banana
// pixel rule (each side 512–2880, multiple of 32, ≤ 2^22 px total)
const SIZES = new Set(["1024x1024", "768x1344", "864x1152", "1344x768", "1152x864"]);

// enhancer lanes: flash models FIRST (2-5s), kimi as quality backup. The
// primary painter is the zero-auth fast lane (~6s measured 2026-11-19), so
// the enhancer must never add real latency — an 8s cap keeps the total paint
// job inside the fast lane's own floor.
const ENHANCERS = ["glm-4.5-flash", "dpsk-4.1-flash", "kimi-k2", "glm-4.6"];
// Arena lanes — every model id below was probe-verified against the gateway
// 2026-11-22 (19/19 returned real images, 11.7-24s at 512px; 16:9 renders run
// ~30-45s on the heavy models). Ordered FASTEST-FIRST: the worker pool pulls
// from the head of this queue, so an image lands well inside the Vercel cap
// even when the heavy painters never get their turn. A specific model pick
// races just that lane (+ the free lane as a silent backup so a pick can
// never hard-fail).
const PAINTERS: (string | undefined)[] = [
  "wan-2.7-image",              // 11.7s @512 — fastest verified
  "grok-imagein-image",         // 11.8s
  "gemini-2.5-flash-image",     // nano banana flash
  "flux-3-image-klein",         // 12.2s
  "muse-image",                 // 12.2s
  "seedream-5.9-lite",          // 12.5s
  "qwen-image-2.0-pro",         // 12.5s
  "uni-1.1",                    // 12.8s
  "mai-image-2.7",              // 13.2s
  "qwen-image-2.0",             // 18.5s
  "seedream-5.0-pro",           // 13.4s
  "uni-1.1-max",                // 13.5s
  "krea-3-high",                // 12.8s
  "cogview-4",                  // 18.5s
  "krea-2-medium",              // 24.1s
  "glm-image",                  // GLM photo gen (slow at 16:9 — kept mid-queue)
  "hunyuan-image-3.0-instruct", // 21.9s
  "ideogram-4.5",               // 21.0s
  "glm-4.5-image",              // 12.8s
  "gemini-3-pro-image-preview", // nano banana pro — 33-39s @16:9, last resort
  undefined,                    // gateway default painter
];

function withJail(ms: number): Promise<null> {
  return new Promise(r => setTimeout(() => r(null), ms));
}

// Kimi turns the user's idea into one vivid English image prompt. Never
// blocks the generator: any failure just returns null and the raw idea
// (plus the chosen style suffix) is painted as-is.
async function enhance(prompt: string, style: string, base: string): Promise<{ text: string; model: string } | null> {
  const styleLine = STYLES[style] || "";
  const sys =
    "You are the prompt engineer inside an image generator. Rewrite the user's idea as ONE vivid, " +
    "concrete English image prompt for a text-to-image model: name the subject, the setting, the " +
    "lighting, the mood and the composition. Keep every fact of the original idea intact, never ask " +
    "questions, never add captions, watermarks or text into the scene unless the user asked for text. " +
    "Maximum 90 words. Reply with ONLY the prompt sentence(s) — no quotes, no preface, no explanations." +
    (base
      ? "\n\nAn earlier image in this conversation was painted from this prompt: \"" + base.slice(0, 600) + "\". " +
        "If the user's message is a tweak or continuation of it (\"make it night\", \"add snow\", \"same but red\", " +
        "\"now a close-up\"), EDIT that earlier prompt: apply the change, keep everything else that made it work. " +
        "If the message is a completely new unrelated image request, ignore the earlier prompt and write fresh."
      : "");
  const user = styleLine
    ? `${prompt}\n\n(Extra style direction to weave in: ${styleLine})`
    : prompt;
  // one GLOBAL budget for the whole enhancer chain — the old 8s-per-model
  // jail × 4 serial models could burn 32s before a single pixel was painted
  const enhanceDeadline = Date.now() + 6000;
  for (const model of ENHANCERS) {
    if (Date.now() >= enhanceDeadline) break;
    try {
      const zai = await ZAI.create();
      const res = (await Promise.race([
        zai.chat.completions.create({
          model,
          messages: [
            { role: "system", content: sys },
            { role: "user", content: user },
          ],
          thinking: { type: "disabled" },
        }),
        withJail(Math.max(1000, enhanceDeadline - Date.now())),
      ])) as { choices?: { message?: { content?: string } }[] } | null;
      const text = (res?.choices?.[0]?.message?.content || "").trim();
      if (text && text.length > 8 && text.length < 1200) {
        return { text: text.replace(/^["'`\s]+|["'`\s]+$/g, ""), model };
      }
    } catch (e) {
      console.error("[imagine] enhancer", model, "failed:", String((e as Error)?.message || e).slice(0, 120));
    }
  }
  return null;
}

// the free fast lane stamps a small "pollinations.ai" watermark in the
// bottom-right corner. Erase it: mirror the clean strip of image right
// above the watermark band over it, blurred to blend the seam. Never
// fails the paint — on any error the original buffer ships as-is.
async function deWatermark(buf: Buffer): Promise<Buffer> {
  try {
    const { default: sharp } = await import("sharp");
    const meta = await sharp(buf).metadata();
    const w = meta.width, h = meta.height;
    if (!w || !h || h < 200) return buf;
    const ph = Math.max(24, Math.round(h * 0.075));   // watermark band ~7.5% of height
    const pw = Math.min(w - 8, Math.round(h * 0.34)); // band width ~34% of height
    const px = w - pw, py = h - ph;
    const sy = Math.max(0, py - ph);                  // clean strip just above the band
    const strip = await sharp(buf)
      .extract({ left: px, top: sy, width: pw, height: ph })
      .flip()
      .blur(6)
      .toBuffer();
    return Buffer.from(await sharp(buf).composite([{ input: strip, left: px, top: py }]).jpeg({ quality: 92 }).toBuffer());
  } catch (e) {
    console.error("[imagine] dewatermark skipped:", String(e).slice(0, 100));
    return buf;
  }
}

// the painter: race ALL lanes in parallel — first valid image wins. This is
// what the video pipeline does, and it kills the "busy · retrying" UX where a
// 503 on the fast lane forced a serial fall-through to a 50s model. Every lane
// has its own timeout + jail, so a dead lane never blocks the others.
//
// Pollinations free tier rate-limits to ~1 image/45s per IP — Vercel shares
// egress IPs across all users so the limit is hit instantly. Racing 4 lanes
// with distinct seeds + a Referer header (which Pollinations rewards with a
// higher free quota) means at least one almost always lands.
async function paintPollinations(prompt: string, size: string): Promise<{ url: string; model: string } | null> {
  const [w, h] = size.split("x").map(Number);
  const seed = () => Math.floor(Math.random() * 1e9);
  const fetchOne = async (s: number): Promise<{ url: string; model: string } | null> => {
    try {
      const u = "https://image.pollinations.ai/prompt/" + encodeURIComponent(prompt.slice(0, 1800)) +
        `?width=${w}&height=${h}&nologo=true&nofeed=true&seed=${s}`;
      const res = (await Promise.race([
        fetch(u, { signal: AbortSignal.timeout(28000), headers: { Referer: "https://xr-code.vercel.app" } }),
        withJail(30000),
      ])) as Response | null;
      if (!res || res.status === 402 || res.status === 429 || res.status === 502 || res.status === 503 || !res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 2000) return null;
      const head = buf.subarray(0, 4).toString("hex");
      if (!head.startsWith("ffd8") && !head.startsWith("8950")) return null;
      const clean = await deWatermark(buf);
      const url = await saveAsset(clean, "jpg");
      return { url, model: "fast-painter" };
    } catch {
      return null;
    }
  };
  // race 4 lanes — first valid image wins, losers absorbed
  const lanes = [fetchOne(seed()), fetchOne(seed()), fetchOne(seed()), fetchOne(seed())];
  return new Promise((resolve) => {
    let pending = lanes.length, resolved = false;
    for (const p of lanes) {
      p.then((r) => {
        if (resolved) return;
        if (r) { resolved = true; resolve(r); }
        else if (--pending === 0) resolve(null);
      }).catch(() => { if (!resolved && --pending === 0) resolve(null); });
    }
  });
}

async function paintZai(prompt: string, size: string, model?: string): Promise<{ url: string; model: string } | null> {
  try {
    const zai = await ZAI.create();
    const body: Record<string, unknown> = { prompt, size };
    if (model) body.model = model;
    const res = (await Promise.race([
      zai.images.generations.create(body as Parameters<typeof zai.images.generations.create>[0]),
      withJail(50000), // 16:9 paints take 30-36s on the gateway — let the slot-holder finish
    ])) as { data?: { base64?: string }[] } | null;
    const b64 = res?.data?.[0]?.base64;
    if (!b64) return null;
    const url = await saveAsset(Buffer.from(b64, "base64"), "png");
    return { url, model: model || "default-painter" };
  } catch {
    return null;
  }
}

async function paint(prompt: string, size: string, pick?: string): Promise<{ url: string; model: string } | null> {
  // Gateway reality (measured 2026-11-22): image paints SERIALIZE — extra
  // concurrent calls get instant 429s — and a 16:9 paint takes 30-36s. So
  // ONE worker walks the fast-first queue with a 50s jail (long enough for
  // a slot-holding paint to finish), plus 2 free pollinations lanes racing
  // alongside. Budget: enhance ≤6s + paint ≤50s = 56s < 60s Vercel cap.
  const deadline = Date.now() + 50000;
  const models: (string | undefined)[] = pick && pick !== "auto"
    ? [pick, undefined] // explicit pick + gateway-default backup so a pick never hard-fails
    : [...PAINTERS];
  const worker = async (): Promise<{ url: string; model: string } | null> => {
    while (models.length && Date.now() < deadline) {
      const r = await paintZai(prompt, size, models.shift()!);
      if (r) return r;
      // a 429-rate-window needs a beat to clear before the next pull
      await new Promise(res => setTimeout(res, 1200));
    }
    return null;
  };
  const lanes: Promise<{ url: string; model: string } | null>[] = [
    paintPollinations(prompt, size),
    paintPollinations(prompt, size),
    worker(),
  ];
  // first-non-null wins; if all fail, return null
  return new Promise((resolve) => {
    let pending = lanes.length;
    let resolved = false;
    for (const p of lanes) {
      p.then((r) => {
        if (resolved) return;
        if (r) { resolved = true; resolve(r); }
        else if (--pending === 0) resolve(null);
      }).catch(() => {
        if (resolved) return;
        if (--pending === 0) resolve(null);
      });
    }
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, engine: "imagine" });
}

export async function POST(req: Request) {
  // Google session gate — verified account only. Fail closed.
  const gv = await verifyRequest(req);
  if (!gv.ok)
    return NextResponse.json({ ok: false, error: "auth", auth: gv.error }, { status: 401 });
  const uid = gv.uid || "";

  // ---- free-tier quota gate (10 images / day / Google account) ----
  const q = await mediaOverLimit(uid, "image");
  if (q.over) {
    return NextResponse.json({
      ok: false,
      error: "You've used today's 10-image allowance for this account — it resets at 00:00 UTC.",
      limit: true,
      usage: { used: q.used, limit: q.limit, day: q.day },
    }, { status: 429 });
  }

  const t0 = Date.now();
  let body: { prompt?: unknown; style?: unknown; size?: unknown; base?: unknown; model?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    /* empty body */
  }
  const raw = String(body.prompt || "").trim();
  if (raw.length < 2) {
    return NextResponse.json({ ok: false, error: "Describe the image you want in a few words." }, { status: 400 });
  }
  const prompt = raw.slice(0, 600);
  const style = typeof body.style === "string" && STYLES[body.style] !== undefined ? body.style : "auto";
  const size = typeof body.size === "string" && SIZES.has(body.size) ? body.size : "1344x768";

  const base = typeof body.base === "string" ? body.base.slice(0, 600) : "";
  const pick = typeof body.model === "string" && body.model && body.model !== "auto" ? body.model : undefined;

  console.log("[imagine] job:", JSON.stringify({ prompt: prompt.slice(0, 80), style, size, pick: pick || "auto", refine: !!base }));
  const enhanced = await enhance(prompt, style, base);
  const paintPrompt = enhanced ? enhanced.text : `${prompt}${STYLES[style] ? ". " + STYLES[style] : ""}`;
  const painted = await paint(paintPrompt, size, pick);

  if (!painted) {
    console.error("[imagine] all painters failed after", Date.now() - t0, "ms");
    return NextResponse.json(
      { ok: false, error: "The art models are warming up right now — give it a moment and try again." },
      { status: 502 }
    );
  }
  const ms = Date.now() - t0;
  console.log("[imagine] done:", painted.model, ms, "ms →", painted.url);
  // count this image against the account's daily cap AFTER a successful paint
  const usage = await addMedia(uid, "images", 1);
  return NextResponse.json({
    ok: true,
    url: painted.url,
    enhanced: enhanced ? enhanced.text : "",
    prompt: paintPrompt,
    ms,
    engine: painted.model,
    usage: { used: usage.images, limit: q.limit, day: usage.day },
  });
}

import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { assetDir } from "../../../lib/asset-dir";
import { verifyRequest } from "../../../lib/request-auth";

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

// stable asset dir — same store the chat brain already uses
const ASSET_DIR = assetDir();

// enhancer lanes: flash models FIRST (2-5s), kimi as quality backup. The
// primary painter is the zero-auth fast lane (~6s measured 2026-11-19), so
// the enhancer must never add real latency — an 8s cap keeps the total paint
// job inside the fast lane's own floor.
const ENHANCERS = ["glm-4.5-flash", "dpsk-4.1-flash", "kimi-k2", "glm-4.6"];
const PAINTERS: (string | undefined)[] = [
  "gemini-3-pro-image-preview", // nano banana pro — primary painter
  "gemini-2.5-flash-image", // nano banana — first fallback
  undefined, // gateway default painter — last lane
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
  for (const model of ENHANCERS) {
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
        withJail(8000),
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

// the painter: Pollinations fast lane first (zero-auth FLUX-class, measured
// 6.1s/1024px from this host, 2026-11-19), then nano banana pro, nano banana,
// and the gateway default lane as quality fallbacks.
// The fast lane retries 3x with backoff — the free tier rate-limits bursts,
// and a short pause clears a 429 where falling straight to the 30s+ slow
// lanes would hang the request and read as "not working" on the user's screen.
async function paintFast(prompt: string, size: string): Promise<{ url: string; model: string } | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await withJail(1500 + attempt * 2500);
    try {
      const [w, h] = size.split("x").map(Number);
      const url = "https://image.pollinations.ai/prompt/" + encodeURIComponent(prompt.slice(0, 1800)) +
        `?width=${w}&height=${h}&nologo=true&nofeed=true&seed=${Math.floor(Math.random() * 1e9)}`;
      const res = (await Promise.race([
        fetch(url, { signal: AbortSignal.timeout(28000) }),
        withJail(30000),
      ])) as Response | null;
      if (!res) continue;
      if (res.status === 429 || res.status === 502 || res.status === 503) {
        console.error("[imagine] fast lane busy:", res.status, "attempt", attempt + 1);
        continue;
      }
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 2000) continue; // error page / blank — reject
      const head = buf.subarray(0, 4).toString("hex");
      if (!head.startsWith("ffd8") && !head.startsWith("8950")) continue; // not JPEG/PNG
      const clean = await deWatermark(buf);                              // kill the corner watermark
      fs.mkdirSync(ASSET_DIR, { recursive: true });
      const id = randomUUID().replace(/-/g, "").slice(0, 20);
      fs.writeFileSync(path.join(ASSET_DIR, id + ".jpg"), clean);
      return { url: `/api/asset/${id}`, model: "fast-painter" };
    } catch (e) {
      console.error("[imagine] fast painter failed:", String(e).slice(0, 140));
    }
  }
  return null;
}

async function paint(
  prompt: string,
  size: string
): Promise<{ url: string; model: string } | null> {
  const fast = await paintFast(prompt, size);
  if (fast) return fast;
  for (const model of PAINTERS) {
    try {
      const zai = await ZAI.create();
      const body: Record<string, unknown> = { prompt, size };
      if (model) body.model = model;
      const res = (await Promise.race([
        zai.images.generations.create(body as Parameters<typeof zai.images.generations.create>[0]),
        withJail(45000), // dead quota lanes must not hang the request for minutes
      ])) as { data?: { base64?: string }[] } | null;
      const b64 = res?.data?.[0]?.base64;
      if (!b64) {
        console.error("[imagine] painter", model || "default", "returned no base64");
        continue;
      }
      fs.mkdirSync(ASSET_DIR, { recursive: true });
      const id = randomUUID().replace(/-/g, "").slice(0, 20);
      fs.writeFileSync(path.join(ASSET_DIR, id + ".png"), Buffer.from(b64, "base64"));
      return { url: `/api/asset/${id}`, model: model || "default-painter" };
    } catch (e) {
      console.error("[imagine] painter", model || "default", "failed:", String((e as Error)?.message || e).slice(0, 160));
    }
  }
  return null;
}

export async function GET() {
  return NextResponse.json({ ok: true, engine: "imagine" });
}

export async function POST(req: Request) {
  // Discord gate — verified member (XR-Auth role) only. Fail closed.
  const gv = await verifyRequest(req);
  if (!gv.ok)
    return NextResponse.json({ ok: false, error: "auth", auth: gv.error }, { status: 401 });
  const t0 = Date.now();
  let body: { prompt?: unknown; style?: unknown; size?: unknown; base?: unknown } = {};
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
  const size = typeof body.size === "string" && SIZES.has(body.size) ? body.size : "1024x1024";

  const base = typeof body.base === "string" ? body.base.slice(0, 600) : "";

  console.log("[imagine] job:", JSON.stringify({ prompt: prompt.slice(0, 80), style, size, refine: !!base }));
  const enhanced = await enhance(prompt, style, base);
  const paintPrompt = enhanced ? enhanced.text : `${prompt}${STYLES[style] ? ". " + STYLES[style] : ""}`;
  const painted = await paint(paintPrompt, size);

  if (!painted) {
    console.error("[imagine] all painters failed after", Date.now() - t0, "ms");
    return NextResponse.json(
      { ok: false, error: "The art models are warming up right now — give it a moment and try again." },
      { status: 502 }
    );
  }
  const ms = Date.now() - t0;
  console.log("[imagine] done:", painted.model, ms, "ms →", painted.url);
  return NextResponse.json({
    ok: true,
    url: painted.url,
    enhanced: enhanced ? enhanced.text : "",
    prompt: paintPrompt,
    ms,
  });
}

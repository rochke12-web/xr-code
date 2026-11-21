// Probe each video model lane directly — see what the gateway actually returns.
import ZAI from "z-ai-web-dev-sdk";
import crypto from "crypto";

const MODELS = ["seedance-1.0-pro", "seedance-1.0-lite", "cogvideox-3", undefined];

const zai = await ZAI.create();
for (const m of MODELS) {
  const body = {
    prompt: "a red paper plane flying over a sunny city, cinematic",
    quality: "speed", with_audio: false, size: "1280x720", fps: 30, duration: 5,
    watermark_enabled: false,
    request_id: crypto.randomBytes(8).toString("hex"),
    ...(m ? { model: m } : {}),
  };
  try {
    const t = await Promise.race([
      zai.video.generations.create(body),
      new Promise((r) => setTimeout(() => r("TIMEOUT"), 25000)),
    ]);
    console.log(`[${m || "default"}] OK:`, JSON.stringify(t).slice(0, 160));
  } catch (e) {
    console.log(`[${m || "default"}] ERR:`, String(e).slice(0, 300));
  }
}

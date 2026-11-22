// Probe which video models the gateway serves: unsupported ids error
// instantly at create(); supported ones return a task id.
import ZAI from "z-ai-web-dev-sdk";

const CANDIDATES = [
  "grok-imagine-video", "grok-imagine-video-1.5", "sora-2", "sora-2-pro",
  "veo-3", "veo-3-fast", "veo-2", "kling-2.5-turbo", "kling-2.1-master",
  "kling-2.6-pro", "luma-ray3", "luma-ray2", "minimax-h3", "hailuo-02-pro",
  "hailuo-02-standard", "hailuo-2.3", "seedance-1.0-pro", "seedance-1.0-lite",
  "hunyuan-video-1.5", "wan-3.0", "wan-2.7-video", "wan-2.2", "ltx-2",
  "pika-2.2", "mochi-1", "skyreels-v4", "muse-video", "happyhorse-1.0",
  "kandinsky-5.0-video-lite", "runway-gen-4.5", "pixverse-v5.6",
];
const zai = await ZAI.create();
for (const m of CANDIDATES) {
  try {
    const r = await Promise.race([
      zai.video.generations.create({ model: m, prompt: "a red cube rotating on white background", quality: "speed", size: "1280x720", fps: 30, duration: 5 }),
      new Promise<null>(res => setTimeout(() => res(null), 20000)),
    ]);
    console.log(`${m}: ${r?.id ? "SERVED id=" + r.id : "no-id"}`);
  } catch (e) {
    console.log(`${m}: ✗ ${String(e?.message || e).slice(0, 70).replace(/\n/g, " ")}`);
  }
}

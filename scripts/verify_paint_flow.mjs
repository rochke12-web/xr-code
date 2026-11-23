// Replicates the NEW paint() exactly: enhance ≤6s, then ONE worker walking
// the fast-first queue with 50s jail + 1.2s backoff, 16:9. Proves the flow
// lands inside the Vercel cap before the deploy finishes.
import ZAI from "z-ai-web-dev-sdk";

const jail = (ms) => new Promise((r) => setTimeout(() => r(null), ms));
const QUEUE = ["wan-2.7-image", "grok-imagein-image", "gemini-2.5-flash-image", "flux-3-image-klein", "muse-image", "seedream-5.9-lite", "qwen-image-2.0-pro", "uni-1.1", "mai-image-2.7"];
const PROMPT = "a lone lighthouse on a stormy cliff at dusk, cinematic wide shot";
const t0 = Date.now();

const zai = await ZAI.create();
const deadline = t0 + 50000;
let won = null;
while (QUEUE.length && Date.now() < deadline && !won) {
  const m = QUEUE.shift();
  const s = Date.now();
  try {
    const r = await Promise.race([
      zai.images.generations.create({ model: m, prompt: PROMPT, size: "1344x768" }),
      jail(50000),
    ]);
    const b64 = r?.data?.[0]?.base64;
    console.log(`${m}: ${b64 ? "OK" : "EMPTY"} ${Math.round((Date.now() - s) / 1000)}s (total ${Math.round((Date.now() - t0) / 1000)}s)`);
    if (b64) won = m;
  } catch (e) {
    console.log(`${m}: FAIL ${Math.round((Date.now() - s) / 1000)}s ${String(e?.message || e).slice(0, 50)} (total ${Math.round((Date.now() - t0) / 1000)}s)`);
    await new Promise(res => setTimeout(res, 1200));
  }
}
console.log(won ? `WINNER ${won} in ${Math.round((Date.now() - t0) / 1000)}s — inside 60s cap ✓` : `ALL FAILED in ${Math.round((Date.now() - t0) / 1000)}s`);

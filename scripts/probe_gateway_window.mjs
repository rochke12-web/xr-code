// Probe: 3 sequential paints like the app does (single worker, fast-first
// queue) to see exactly what the gateway returns after a few paints.
import ZAI from "z-ai-web-dev-sdk";

const jail = (ms) => new Promise((r) => setTimeout(() => r(null), ms));
const zai = await ZAI.create();
const MODELS = ["wan-2.7-image", "grok-imagein-image", "gemini-2.5-flash-image"];
for (const m of MODELS) {
  const s = Date.now();
  try {
    const r = await Promise.race([
      zai.images.generations.create({ model: m, prompt: "a blue origami crane on white sand, minimal", size: "1344x768" }),
      jail(40000),
    ]);
    const b64 = r?.data?.[0]?.base64;
    console.log(`${m}: ${b64 ? "OK " + Math.round(b64.length / 1024) + "KB" : "EMPTY"} ${Math.round((Date.now() - s) / 1000)}s`);
  } catch (e) {
    const msg = String(e?.message || e).slice(0, 120).replace(/\n/g, " ");
    console.log(`${m}: FAIL ${Math.round((Date.now() - s) / 1000)}s ${msg}`);
  }
}

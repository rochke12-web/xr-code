// Measure REAL 16:9 paint times on the fast lanes, in parallel (like the
// app's 3 workers), with a 50s jail — to size the Vercel budgets correctly.
import ZAI from "z-ai-web-dev-sdk";

const jail = (ms) => new Promise((r) => setTimeout(() => r(null), ms));
const MODELS = ["wan-2.7-image", "grok-imagein-image", "gemini-2.5-flash-image", "muse-image", "flux-3-image-klein"];
const PROMPT = "a red paper boat on a calm blue lake at sunrise, cinematic";

const t0 = Date.now();
const zai = await ZAI.create();
const res = await Promise.all(MODELS.map(async (model) => {
  const s = Date.now();
  try {
    const r = await Promise.race([
      zai.images.generations.create({ model, prompt: PROMPT, size: "1344x768" }),
      jail(50000),
    ]);
    const b64 = r?.data?.[0]?.base64;
    return `${model}: ${b64 ? "OK" : "EMPTY"} ${Math.round((Date.now() - s) / 1000)}s`;
  } catch (e) {
    return `${model}: FAIL ${Math.round((Date.now() - s) / 1000)}s ${String(e?.message || e).slice(0, 60)}`;
  }
}));
console.log(res.join("\n"), "\ntotal", Math.round((Date.now() - t0) / 1000) + "s");

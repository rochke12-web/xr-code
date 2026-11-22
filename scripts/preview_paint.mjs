// Preview: paint through the same gateway painters the app arena uses.
// glm-image (GLM photo gen) + gemini-3-pro-image-preview, 16:9 (1344x768) —
// the new app defaults. Saves JPEGs under download/.
import ZAI from "z-ai-web-dev-sdk";

const jail = (ms) => new Promise((r) => setTimeout(() => r(null), ms));
const PROMPT = "a golden retriever astronaut floating above a neon Mars city at dusk, cinematic wide shot, volumetric light, ultra detailed";

async function paint(model, size, out) {
  const t0 = Date.now();
  try {
    const zai = await ZAI.create();
    const res = (await Promise.race([
      zai.images.generations.create({ model, prompt: PROMPT, size }),
      jail(45000),
    ]));
    const b64 = res?.data?.[0]?.base64;
    if (!b64) { console.log(model, "EMPTY", Date.now() - t0, "ms"); return false; }
    const buf = Buffer.from(b64, "base64");
    await import("fs").then(fs => fs.writeFileSync(out, buf));
    console.log(model, "OK", Math.round((Date.now() - t0) / 1000) + "s", Math.round(buf.length / 1024) + "KB →", out);
    return true;
  } catch (e) {
    console.log(model, "FAIL", Date.now() - t0, "ms", String(e?.message || e).slice(0, 100));
    return false;
  }
}

const r1 = await paint("mai-image-2.7", "1344x768", "/home/z/my-project/download/preview-1-glm.jpg");
const r2 = await paint("gemini-3-pro-image-preview", "1344x768", "/home/z/my-project/download/preview-2-gemini.jpg");
console.log(r1 && r2 ? "DONE both" : r1 || r2 ? "DONE partial" : "FAILED all");

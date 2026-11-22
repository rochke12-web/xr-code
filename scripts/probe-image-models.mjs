// Probe which image model IDs the Z.ai gateway actually accepts.
import ZAI from "z-ai-web-dev-sdk";

const CANDIDATES = [
  "glm-image", "glm-4.5-image", "cogview-4", "cogview-3-flash",
  "mai-image-2.7", "muse-image", "seedream-5.0-pro", "qwen-image-2.0-pro",
  "uni-1.1-max", "uni-1.1", "grok-imagein-image", "seedream-5.9-lite",
  "krea-2-medium", "wan-2.7-image", "krea-3-high", "flux-3-image-klein",
  "hunyuan-image-3.0-instruct", "ideogram-4.5", "qwen-image-2.0",
];

const jail = (ms) => new Promise((r) => setTimeout(() => r(null), ms));

const zai = await ZAI.create();
const out = [];
for (const model of CANDIDATES) {
  const t0 = Date.now();
  try {
    const res = (await Promise.race([
      zai.images.generations.create({ model, prompt: "a tiny red cube on white background", size: "512x512" }),
      jail(30000),
    ]));
    const b64 = res?.data?.[0]?.base64;
    const ms = Date.now() - t0;
    if (b64 && b64.length > 1000) {
      out.push(`${model}: OK ${ms}ms b64=${Math.round(b64.length / 1024)}KB`);
      console.log(out[out.length - 1]);
    } else {
      out.push(`${model}: EMPTY ${ms}ms`);
      console.log(out[out.length - 1]);
    }
  } catch (e) {
    const msg = String(e?.message || e).slice(0, 90).replace(/\n/g, " ");
    out.push(`${model}: FAIL ${Date.now() - t0}ms ${msg}`);
    console.log(out[out.length - 1]);
  }
}
await import("fs").then((fs) => fs.writeFileSync("/home/z/my-project/scripts/probe-image-models.log", out.join("\n")));
console.log("DONE");

// Time a production-shaped task: duration 10, 1920x1080, speed — measure create + poll to SUCCESS.
import ZAI from "z-ai-web-dev-sdk";
import crypto from "crypto";

const zai = await ZAI.create();
const t0 = Date.now();
let id = null, model = "?";
for (let i = 0; i < 6 && !id; i++) {
  try {
    const t = await zai.video.generations.create({
      prompt: "a golden paper plane gliding over neon rooftops at dusk, cinematic drone shot",
      model: "cogvideox-3", quality: "speed", with_audio: false,
      size: "1920x1080", fps: 30, duration: 10, watermark_enabled: false,
      request_id: crypto.randomBytes(8).toString("hex"),
    });
    id = t?.id; model = t?.model; if (id) break;
  } catch (e) { console.log(`create r${i + 1}:`, String(e).slice(0, 90)); }
  await new Promise(r => setTimeout(r, 8000));
}
if (!id) { console.log("CREATE FAILED"); process.exit(1); }
console.log(`created @${((Date.now() - t0) / 1000) | 0}s model=${model} id=${id}`);
for (let i = 0; i < 110; i++) {
  await new Promise(r => setTimeout(r, 3000));
  let r = null;
  try { r = await zai.async.result.query(id); } catch { continue; }
  const s = ((Date.now() - t0) / 1000) | 0;
  if (r?.task_status === "SUCCESS") { console.log(`SUCCESS @${s}s url=${r?.video_result?.[0]?.url?.slice(0, 50)}`); break; }
  if (r?.task_status === "FAIL") { console.log(`FAIL @${s}s`); break; }
  if (i % 10 === 0) console.log(`${s}s ${r?.task_status}`);
}

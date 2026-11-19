// Benchmark 2: can a lighter render go faster than 144.9s?
// model "cogvideox-2" (gen-2) + 1280x720 + fps 24 + speed + no audio
import ZAI from "z-ai-web-dev-sdk";

const t0 = Date.now();
const s = () => `+${((Date.now() - t0) / 1000).toFixed(1)}s`;
const log = (...a) => console.log(s(), ...a);

(async () => {
  const zai = await ZAI.create();
  log("creating cogvideox-2 @ 720p/24fps...");
  let task = null;
  try {
    task = await zai.video.generations.create({
      model: "cogvideox-2",
      prompt: "A green kite dancing in the wind above a golden wheat field, smooth cinematic motion, warm sunlight",
      quality: "speed", with_audio: false, size: "1280x720", fps: 24, duration: 5,
    });
  } catch (e) {
    log("CREATE FAILED:", String(e).slice(0, 300));
    process.exit(1);
  }
  log("task:", task?.id, "resolved model:", task?.model || "(n/a)");
  const tc = Date.now();
  for (let i = 0; i < 100; i++) {
    let r = null;
    try {
      r = await Promise.race([
        zai.async.result.query(task.id),
        new Promise((res) => setTimeout(() => res(null), 8000)),
      ]);
    } catch {}
    if (r?.task_status === "SUCCESS") {
      log("SUCCESS in", ((Date.now() - tc) / 1000).toFixed(1), "s");
      process.exit(0);
    }
    if (r?.task_status === "FAIL") { log("FAIL"); process.exit(1); }
    await new Promise((res) => setTimeout(res, 3000));
  }
  log("window exhausted");
  process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });

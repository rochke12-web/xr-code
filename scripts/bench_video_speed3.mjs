// Benchmark 3: exact production baseline — NO model param, 1080p/30fps/speed/no-audio.
// Decides: is the flash alias (→cogvideox-3, measured 144.9s) better or worse
// than whatever the default engine is?
import ZAI from "z-ai-web-dev-sdk";

const t0 = Date.now();
const s = () => `+${((Date.now() - t0) / 1000).toFixed(1)}s`;
const log = (...a) => console.log(s(), ...a);

(async () => {
  const zai = await ZAI.create();
  log("creating DEFAULT config (no model) @ 1080p/30...");
  let task = null;
  try {
    task = await zai.video.generations.create({
      prompt: "An orange origami crane unfolding itself on a wooden desk, soft morning light, macro shot, smooth motion",
      quality: "speed", with_audio: false, size: "1920x1080", fps: 30, duration: 5,
    });
  } catch (e) {
    log("CREATE FAILED:", String(e).slice(0, 300));
    process.exit(1);
  }
  log("task:", task?.id, "resolved model:", task?.model || "(default/hidden)");
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

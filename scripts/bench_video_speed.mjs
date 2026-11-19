// Benchmark: how fast can the Z.ai video engine actually go?
// A: model "cogvideox-flash" @ current settings (1080p/30fps/speed)
// B: no model @ current settings (today's production config) — baseline
// Both tasks created together, polled every 3s, first-query immediately.
import ZAI from "z-ai-web-dev-sdk";

const t0 = Date.now();
const s = () => `+${((Date.now() - t0) / 1000).toFixed(1)}s`;
const log = (...a) => console.log(s(), ...a);

const CFG = { quality: "speed", with_audio: false, size: "1920x1080", fps: 30, duration: 5 };

async function run(zai, label, body) {
  const tc = Date.now();
  let task = null;
  try {
    task = await zai.video.generations.create(body);
  } catch (e) {
    log(label, "CREATE FAILED:", String(e).slice(0, 160));
    return { label, ms: null, err: true };
  }
  log(label, "task created:", task?.id, "model:", task?.model || "(default)");
  if (!task?.id) return { label, ms: null, err: true };
  const id = task.id;
  // poll: first check right away, then every 3s (query race 8s)
  for (let i = 0; i < 100; i++) {
    let r = null;
    try {
      r = await Promise.race([
        zai.async.result.query(id),
        new Promise((res) => setTimeout(() => res(null), 8000)),
      ]);
    } catch (e) {
      // ignore blips
    }
    if (r?.task_status === "SUCCESS") {
      const ms = Date.now() - tc;
      log(label, "SUCCESS in", (ms / 1000).toFixed(1), "s  url:", (r.video_result?.[0]?.url || "").slice(0, 90));
      return { label, ms, url: r.video_result?.[0]?.url };
    }
    if (r?.task_status === "FAIL") {
      log(label, "FAIL after", ((Date.now() - tc) / 1000).toFixed(1), "s");
      return { label, ms: null, err: true };
    }
    await new Promise((res) => setTimeout(res, 3000));
  }
  return { label, ms: null, err: true };
}

(async () => {
  const zai = await ZAI.create();
  log("benchmark start");
  const results = await Promise.all([
    run(zai, "A[cogvideox-flash]", { ...CFG, model: "cogvideox-flash", prompt: "A red paper plane gliding through a sunny blue sky over white clouds, smooth cinematic motion" }),
    run(zai, "B[default]", { ...CFG, prompt: "A blue paper plane gliding through a sunny blue sky over white clouds, smooth cinematic motion" }),
  ]);
  console.log("=== RESULTS ===");
  for (const r of results) console.log(r.label, r.err ? "ERROR" : ((r.ms / 1000).toFixed(1) + "s"));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });

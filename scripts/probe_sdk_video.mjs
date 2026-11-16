// Probe: does z-ai-web-dev-sdk video generation actually work here?
// One 5s 1080p task, poll to SUCCESS, download the mp4, report.
import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";

const t0 = Date.now();
const log = (...a) => console.log(`[${Math.round((Date.now() - t0) / 1000)}s]`, ...a);

(async () => {
  const zai = await ZAI.create();
  log("creating task...");
  const task = await zai.video.generations.create({
    prompt: "A friendly robot hand smoothly pouring glowing blue liquid into a glass cup, studio lighting, cinematic close-up, slow motion",
    quality: "speed",
    with_audio: true,
    size: "1920x1080",
    fps: 30,
    duration: 5,
  });
  log("task id:", task?.id);
  if (!task?.id) { console.log("NO TASK ID"); process.exit(1); }
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 10000));
    let r = null;
    try { r = await zai.async.result.query(task.id); } catch (e) { log("query threw:", String(e).slice(0, 120)); continue; }
    log("status:", r?.task_status);
    if (r?.task_status === "SUCCESS") {
      const url = r?.video_result?.[0]?.url;
      log("url:", url);
      if (url) {
        const res = await fetch(url);
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync("/tmp/vetest/sdk_probe.mp4", buf);
        log("downloaded", (buf.length / 1048576).toFixed(1), "MB → /tmp/vetest/sdk_probe.mp4");
      }
      process.exit(0);
    }
    if (r?.task_status === "FAIL") { log("TASK FAILED"); process.exit(1); }
  }
  log("polling window exhausted");
  process.exit(1);
})();

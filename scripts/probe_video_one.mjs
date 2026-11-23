import ZAI from "z-ai-web-dev-sdk";
const zai = await ZAI.create();
try {
  await zai.video.generations.create({ model: "nonexistent-xyz-123", prompt: "test cube", quality: "speed", size: "1280x720", fps: 30, duration: 5 });
  console.log("bogus accepted?!");
} catch (e) {
  console.log("ERROR:", String(e?.message || e).slice(0, 400));
}

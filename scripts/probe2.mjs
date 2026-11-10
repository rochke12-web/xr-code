import ZAI from "z-ai-web-dev-sdk";
// recovery probe — DeepSeek first (the default brain since the user directive),
// then glm + argon as reference. 4 upstream calls total.
const zai = await ZAI.create();
for (const model of ["glm-4.5-flash", "glm-4.6", "dpsk-4.1-flash", "argon"]) {
  try {
    const body = {
      model,
      messages: [{ role: "user", content: "reply with the single word: ok" }],
    };
    if (model.startsWith("glm")) body.thinking = { type: "disabled" };
    const res = await Promise.race([
      zai.chat.completions.create(body),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout 25s")), 25000)),
    ]);
    console.log(`OK   ${model} -> ${String(res?.choices?.[0]?.message?.content || "").trim().slice(0, 40)}`);
  } catch (e) {
    console.log(`FAIL ${model} -> ${String(e?.message || e).replace(/\s+/g, " ").slice(0, 100)}`);
  }
  await new Promise(r => setTimeout(r, 2000));
}

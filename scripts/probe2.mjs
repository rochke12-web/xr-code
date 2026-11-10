import ZAI from "z-ai-web-dev-sdk";
const zai = await ZAI.create();
for (const model of ["glm-4.5-flash", "argon"]) {
  try {
    const res = await Promise.race([
      zai.chat.completions.create({
        model,
        messages: [{ role: "user", content: "reply with the single word: ok" }],
        thinking: { type: "disabled" },
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout 25s")), 25000)),
    ]);
    console.log(`OK   ${model} -> ${String(res?.choices?.[0]?.message?.content || "").trim().slice(0, 40)}`);
  } catch (e) {
    console.log(`FAIL ${model} -> ${String(e?.message || e).replace(/\s+/g, " ").slice(0, 100)}`);
  }
  await new Promise(r => setTimeout(r, 2000));
}

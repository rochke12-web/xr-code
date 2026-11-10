import ZAI from "z-ai-web-dev-sdk";

// candidates: user-suggested "argon" + "dpsk 4.1 flash" (name variants) + GLM control
const candidates = [
  "glm-4.5-flash",      // control — known-good family member
  "argon",
  "argon-flash",
  "argon-4.1-flash",
  "dpsk-4.1-flash",
  "dpsk4.1-flash",
  "dpsk-4.1",
  "dpsk-flash",
  "deepseek-4.1-flash",
  "deepseek-v4.1-flash",
];

const zai = await ZAI.create();
for (const model of candidates) {
  try {
    const res = await Promise.race([
      zai.chat.completions.create({
        model,
        messages: [{ role: "user", content: "reply with the single word: ok" }],
        thinking: { type: "disabled" },
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout 25s")), 25000)),
    ]);
    const text = res?.choices?.[0]?.message?.content || "";
    console.log(`OK    ${model.padEnd(22)} -> ${String(text).trim().slice(0, 40)}`);
  } catch (e) {
    const msg = String(e?.message || e).slice(0, 110).replace(/\s+/g, " ");
    console.log(`FAIL  ${model.padEnd(22)} -> ${msg}`);
  }
  await new Promise(r => setTimeout(r, 1500));
}

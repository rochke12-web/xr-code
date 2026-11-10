const ZAI = require("/home/z/my-project/node_modules/z-ai-web-dev-sdk").default;

const CANDIDATES = [
  "dpsk-4.1",
  "dpsk-4.1-flash",
  "deepseek-v3",
  "deepseek-v3.1",
  "deepseek-v3.2",
  "deepseek-r1",
  "deepseek-chat",
  "deepseek-reasoner",
  "dpsk-v3",
  "dpsk-r1",
];

async function probe(model) {
  try {
    const zai = await ZAI.create();
    const res = await Promise.race([
      zai.chat.completions.create({
        model,
        messages: [{ role: "user", content: "say OK" }],
      }),
      new Promise((r) => setTimeout(() => r(null), 15000)),
    ]);
    const t = res?.choices?.[0]?.message?.content || "";
    console.log(model.padEnd(20), "→", t ? "OK: " + t.trim().slice(0, 30) : "EMPTY-OK");
  } catch (e) {
    const msg = String(e?.message || e).slice(0, 110);
    console.log(model.padEnd(20), "→", msg);
  }
}

(async () => {
  for (const m of CANDIDATES) await probe(m);
})();

const ZAI = require("/home/z/my-project/node_modules/z-ai-web-dev-sdk").default;

async function probe(model) {
  try {
    const zai = await ZAI.create();
    const res = await Promise.race([
      zai.chat.completions.create({
        model,
        messages: [{ role: "user", content: "say OK" }],
        thinking: { type: "disabled" },
      }),
      new Promise((r) => setTimeout(() => r(null), 20000)),
    ]);
    const t = res?.choices?.[0]?.message?.content || "";
    console.log(model.padEnd(16), "→", t ? "OK: " + t.trim().slice(0, 20) : "EMPTY");
  } catch (e) {
    const msg = String(e?.message || e).slice(0, 90);
    console.log(model.padEnd(16), "→ ERR:", msg);
  }
}

(async () => {
  for (const m of ["glm-4.5-flash", "glm-4.6", "argon-flash", "dpsk-4.1-flash"]) await probe(m);
})();

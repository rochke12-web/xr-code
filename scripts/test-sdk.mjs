import ZAI from "z-ai-web-dev-sdk";
try {
  const zai = await ZAI.create();
  const res = await zai.chat.completions.create({
    model: "glm-4.5-flash",
    messages: [{ role: "user", content: "say ok" }],
    thinking: { type: "disabled" },
  });
  console.log("SDK OK:", JSON.stringify(res?.choices?.[0]?.message?.content || "").slice(0, 200));
} catch (e) {
  console.log("SDK FAIL:", (e && (e.message || String(e))) || e);
}

// Probe the live text-AI lanes the chat route uses (keyless, as Vercel runs)
const lanes = [
  ["PL_GEN glm-5.3-flash", "https://gen.pollinations.ai/v1/chat/completions", "z-ai/glm-5.3-flash"],
  ["PL_GEN glm-5.3", "https://gen.pollinations.ai/v1/chat/completions", "z-ai/glm-5.3"],
  ["PL_GEN qwen3.8-max", "https://gen.pollinations.ai/v1/chat/completions", "qwen/qwen3.8-max"],
  ["PL_GEN gpt-5.4-nano", "https://gen.pollinations.ai/v1/chat/completions", "openai/gpt-5.4-nano"],
  ["PL_TXT openai-fast", "https://text.pollinations.ai/openai", "openai-fast"],
  ["PL_TXT openai", "https://text.pollinations.ai/openai", "openai"],
];
const BUDGET = /reached its budget|valid api key is required|raise the key budget|enter\.pollinations\.ai\/(edit-key|keys)/i;
for (const [name, url, model] of lanes) {
  const t = Date.now();
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", Referer: "https://xr-code.vercel.app" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "Reply with exactly: OK" }] }),
      signal: AbortSignal.timeout(20000),
    });
    const j = await r.json().catch(() => null);
    const text = String(j?.choices?.[0]?.message?.content || j?.content || "").trim().slice(0, 90);
    console.log(`${name}: ${r.status} ${Date.now() - t}ms ${BUDGET.test(text) ? "BUDGET-ERR" : JSON.stringify(text)}`);
  } catch (e) {
    console.log(`${name}: FAIL ${Date.now() - t}ms ${String(e).slice(0, 80)}`);
  }
}

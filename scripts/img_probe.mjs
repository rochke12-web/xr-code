// probe: kimi chat + image generation models on the gateway
//  - chat: kimi-k2 (prompt-enhancer candidate)
//  - images: default (CogView), gemini nano banana / pro names
import ZAI from "z-ai-web-dev-sdk";

const log = (t, s) => console.log(new Date().toISOString().slice(11, 19), t, s);

async function chat(model) {
  const t0 = Date.now();
  try {
    const zai = await ZAI.create();
    const r = await Promise.race([
      zai.chat.completions.create({
        model,
        messages: [{ role: "user", content: "Reply with exactly: OK" }],
        thinking: { type: "disabled" },
      }),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout 20s")), 20000)),
    ]);
    log("chat", `${model} -> ${(r?.choices?.[0]?.message?.content || "").trim().slice(0, 40)} (${Date.now() - t0}ms)`);
  } catch (e) {
    log("chat", `${model} -> ERR ${String(e?.message || e).slice(0, 120)} (${Date.now() - t0}ms)`);
  }
}

async function img(model, size = "1024x1024") {
  const t0 = Date.now();
  try {
    const zai = await ZAI.create();
    const body = { prompt: "a tiny red circle on white background", size };
    if (model) body.model = model;
    const r = await Promise.race([
      zai.images.generations.create(body),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout 120s")), 120000)),
    ]);
    const b64 = r?.data?.[0]?.base64;
    const revised = r?.data?.[0]?.revised_prompt;
    log("img", `${model || "(default)"} -> OK b64=${b64 ? Math.round(b64.length / 1024) + "KB" : "MISSING"} revised=${revised ? "yes" : "no"} keys=${Object.keys(r?.data?.[0] || {}).join(",")} (${Date.now() - t0}ms)`);
  } catch (e) {
    log("img", `${model || "(default)"} -> ERR ${String(e?.message || e).slice(0, 160)} (${Date.now() - t0}ms)`);
  }
}

const chatModels = process.argv[2] === "chat-only"
  ? ["kimi-k2"]
  : [];
const imgModels = ["", "gemini-3-pro-image-preview", "gemini-2.5-flash-image", "gemini-2.5-flash-image-preview"];

for (const m of chatModels) await chat(m);
for (const m of imgModels) await img(m);

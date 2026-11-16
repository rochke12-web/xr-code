// QA: prime-vision engine E2E through the REAL :3000 chat route.
//  T1 prime-vision text roundtrip (gateway Anthropic lane answers)
//  T2 prime-vision + image attachment — the reply must reflect the image
//     (GLM vision preprocessor → [VISION] block → prime-vision engine)
//  T3 prime-v1 baseline (gateway alive for the flagship id too)
import { createHmac } from "crypto";
import fs from "fs";

const LIVE = "http://localhost:3000";
const UID = "123456789012345678";
function mint(uid) {
  const src = fs.readFileSync("/home/z/my-project/src/lib/xrsecrets.ts", "utf8");
  const m = src.match(/XR_AUTH_SECRET:\s*"([^"]+)"/);
  const secret = m ? m[1] : "xr-dev-secret-change-me";
  const iat = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", secret).update(uid + "." + iat).digest("hex").slice(0, 40);
  return "v1." + uid + "." + iat + "." + sig;
}
const cookie = "xr_ds=" + mint(UID);
const fails = [];
const ok = (c, l, e) => { console.log((c ? "PASS" : "FAIL") + "  " + l + (e ? "  [" + e + "]" : "")); if (!c) fails.push(l); };

async function chat(model, content, mode = "koder") {
  const r = await fetch(LIVE + "/api/chat", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ model, mode, messages: [{ role: "user", content }] }),
  });
  return r.json();
}

(async () => {
  // T1: prime-vision plain text
  const t1 = await chat("prime-vision", "Reply with exactly the two characters: OK");
  ok(t1?.ok && /OK/i.test(t1.text || ""), "T1 prime-vision text roundtrip", (t1?.text || JSON.stringify(t1)).slice(0, 120));

  // T2: prime-vision + image attachment (the probe image says XR-7)
  const b64 = fs.readFileSync("/tmp/vetest/vision_probe.png").toString("base64");
  const t2 = await chat("prime-vision", [
    { type: "text", text: "Look at my attached image. What is the big code written on it, and what shape is on the left? One short sentence." },
    { type: "image", source: { type: "base64", media_type: "image/png", data: b64 } },
  ]);
  const t2txt = t2?.text || "";
  ok(t2?.ok && /XR[- ]?7/i.test(t2txt), "T2 prime-vision sees the image code", t2txt.slice(0, 160));
  ok(/circle/i.test(t2txt), "T2b prime-vision sees the shape", t2txt.slice(0, 160));

  // T3: prime-v1 flagship sanity
  const t3 = await chat("prime-v1", "Reply with exactly the two characters: OK");
  ok(t3?.ok && /OK/i.test(t3.text || ""), "T3 prime-v1 flagship roundtrip", (t3?.text || JSON.stringify(t3)).slice(0, 120));

  console.log(fails.length ? `\n${fails.length} FAILED` : "\nALL PASS");
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error("QA crashed:", e); process.exit(1); });

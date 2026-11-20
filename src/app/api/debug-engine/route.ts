import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { firebaseDb } from "../../../lib/firebase-server";
import { XR_SECRETS } from "../../../lib/xrsecrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// temporary diagnostic: one GET shows the state of every chat leg in this
// deployment — the ZAI brain, the Prime gateway lane, and the Firestore
// quota vault. Timings + booleans only; no keys, no reply text.
const probe = async (fn: () => Promise<void>) => {
  const t0 = Date.now();
  try { await fn(); return { ok: true, ms: Date.now() - t0 }; }
  catch (e) { return { ok: false, ms: Date.now() - t0, error: String((e as Error)?.message || e).slice(0, 160) }; }
};

export async function GET() {
  const out: Record<string, unknown> = { runtime: process.title || "unknown" };

  out.zai = await probe(async () => {
    const zai = (await Promise.race([
      ZAI.create(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("ZAI.create timeout 8s")), 8000)),
    ])) as Awaited<ReturnType<typeof ZAI.create>>;
    const res = (await Promise.race([
      zai.chat.completions.create({
        model: "glm-4.5-flash",
        messages: [{ role: "user", content: "say ok" }],
        thinking: { type: "disabled" as const },
      }),
      new Promise<null>(r => setTimeout(() => r(null), 15000)),
    ])) as { choices?: { message?: { content?: string } }[] } | null;
    if (!res) throw new Error("chat timed out at 15s");
    if (!String(res?.choices?.[0]?.message?.content || "").trim()) throw new Error("empty reply");
  });

  const base = (process.env.PRIME_BASE_URL || XR_SECRETS.PRIME_API_BASE || "").replace(/\/+$/, "");
  const key = process.env.PRIME_API_KEY || XR_SECRETS.PRIME_API_KEY || "";
  if (!base || !key) {
    out.prime = { ok: false, error: "PRIME_API_BASE / PRIME_API_KEY not configured" };
  } else {
    out.prime = await probe(async () => {
      const res = await Promise.race([
        fetch(base + "/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model: "prime-v1-flash", max_tokens: 8, messages: [{ role: "user", content: "hi" }] }),
          signal: AbortSignal.timeout(20000),
        }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("gateway timeout 20s")), 21000)),
      ]) as Response;
      if (!res.ok) throw new Error("HTTP " + res.status);
    });
  }

  out.firestore = await probe(async () => {
    await firebaseDb().collection("xrUsers").limit(1).get();
  });

  return NextResponse.json(out);
}

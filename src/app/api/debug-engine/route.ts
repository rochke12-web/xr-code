import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// temporary diagnostic: pinpoints which stage of the engine call hangs in production
export async function GET() {
  const out: Record<string, unknown> = { runtime: process.title || "unknown" };
  const t0 = Date.now();
  try {
    const zai = (await Promise.race([
      ZAI.create(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("ZAI.create timeout 8s")), 8000)),
    ])) as Awaited<ReturnType<typeof ZAI.create>>;
    out.createMs = Date.now() - t0;
    const t1 = Date.now();
    const res = (await Promise.race([
      zai.chat.completions.create({
        model: "glm-4.5-flash",
        messages: [{ role: "user", content: "say ok" }],
        thinking: { type: "disabled" as const },
      }),
      new Promise<null>(r => setTimeout(() => r(null), 15000)),
    ])) as { choices?: { message?: { content?: string } }[] } | null;
    out.chatMs = Date.now() - t1;
    out.answer = res?.choices?.[0]?.message?.content ?? null;
    if (!res) out.note = "chat timed out at 15s";
  } catch (e) {
    out.error = String(e).slice(0, 200);
    out.atMs = Date.now() - t0;
  }
  return NextResponse.json(out);
}

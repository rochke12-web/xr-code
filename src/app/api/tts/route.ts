import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

// POST /api/tts { text } → audio/wav binary
// the "talking" half of XR Code — reads any AI reply aloud with GLM voice
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { text?: string } | null;
    const clean = String(body?.text || "").replace(/\s+/g, " ").trim().slice(0, 1200);
    if (!clean) return NextResponse.json({ ok: false, error: "no text" }, { status: 400 });
    const zai = await ZAI.create();
    const resp = (await Promise.race([
      zai.audio.tts.create({
        input: clean,
        voice: "tongtong",
        speed: 1.0,
        response_format: "wav",
        stream: false,
      }),
      new Promise<null>(r => setTimeout(() => r(null), 60000)),
    ])) as unknown as Response | null;
    if (!resp || !resp.arrayBuffer)
      return NextResponse.json({ ok: false, error: "tts timeout" }, { status: 504 });
    const buf = Buffer.from(new Uint8Array(await resp.arrayBuffer()));
    if (buf.length < 100)
      return NextResponse.json({ ok: false, error: "tts failed" }, { status: 502 });
    return new NextResponse(new Uint8Array(buf), {
      headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "tts failed" }, { status: 500 });
  }
}

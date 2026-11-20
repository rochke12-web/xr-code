import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { verifyRequest } from "../../../lib/request-auth";

// POST /api/asr { b64 } → { ok, text }
// speech-to-text: attached voice notes / audio files get transcribed so the
// brain can hear them like everything else
export async function POST(req: Request) {
  // Google session gate — verified account only. Fail closed.
  const gv = await verifyRequest(req);
  if (!gv.ok)
    return NextResponse.json({ ok: false, error: "auth", auth: gv.error }, { status: 401 });
  try {
    const body = (await req.json().catch(() => null)) as { b64?: string } | null;
    const clean = String(body?.b64 || "").replace(/^data:[^,]+,/, "").replace(/\s/g, "");
    if (clean.length < 100)
      return NextResponse.json({ ok: false, error: "no audio" }, { status: 400 });
    if (clean.length > 6_000_000)
      return NextResponse.json({ ok: false, error: "audio too large" }, { status: 413 });
    const zai = await ZAI.create();
    const res = (await Promise.race([
      zai.audio.asr.create({ file_base64: clean }),
      new Promise<null>(r => setTimeout(() => r(null), 60000)),
    ])) as { text?: string } | null;
    const text = String(res?.text || "").trim();
    return NextResponse.json({ ok: true, text });
  } catch {
    return NextResponse.json({ ok: false, error: "asr failed" }, { status: 500 });
  }
}

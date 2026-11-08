import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

// XR CODE hosted brain — no API keys, no model options, nothing to configure.
// GET  /api/chat → health probe { ok: true } for the status bar
// POST /api/chat → one hosted AI brain answers every visitor (server-side SDK)

const SYSTEM =
  "You are XR CODE, the built-in AI of the XR CODE app by YUX FF. " +
  "Answer directly and helpfully: plan, write, explain and debug code. " +
  "Keep answers concise and in plain text (no markdown headings); put code in fenced blocks only when code is needed.";

type Msg = { role: string; content: string };

export async function GET() {
  return NextResponse.json({ ok: true, engine: "xr-code-hosted" });
}

export async function POST(req: Request) {
  let body: { messages?: Msg[] } | null = null;
  try {
    body = await req.json();
  } catch {
    /* no / invalid body */
  }
  const raw = Array.isArray(body?.messages) ? (body!.messages as Msg[]) : null;
  const safe = raw
    ? raw
        .slice(-16)
        .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .map(m => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 8000) }))
    : [];
  if (!safe.length) {
    return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
  }

  let lastErr = "ai error";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [{ role: "assistant", content: SYSTEM }, ...safe],
        thinking: { type: "disabled" },
      });
      const text = String(completion?.choices?.[0]?.message?.content ?? "").trim();
      if (text) return NextResponse.json({ ok: true, text });
      lastErr = "empty reply";
    } catch (e) {
      lastErr = String((e as Error)?.message || e || "ai error");
      if (/429|rate/i.test(lastErr) && attempt === 0) {
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      break;
    }
  }
  return NextResponse.json({ ok: false, error: lastErr });
}

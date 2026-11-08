import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

// XR CODE hosted brain — no API keys, no model options, nothing to configure.
// GET  /api/chat → health probe { ok: true } for the status bar
// POST /api/chat → one hosted AI brain answers every visitor (server-side SDK)

const BASE =
  "You are XR CODE, the built-in AI of the XR CODE app by YUX FF. " +
  "Keep answers concise and in plain text (no markdown headings); put code in fenced blocks only when code is needed. ";

// 4 modes — the frontend sends `mode` with every request
const MODES: Record<string, string> = {
  coder:
    BASE +
    "Coder Mode: focus on writing, refactoring and optimizing code. " +
    "Plan briefly, then give complete, runnable code with short explanations.",
  qna:
    BASE +
    "QnA Mode: answer any type of question — general knowledge, concepts, facts, " +
    "advice, not just coding. Be accurate, concise and friendly.",
  debug:
    BASE +
    "Debug Mode: analyze errors and bugs step by step — locate the root cause, " +
    "explain the fix, then provide corrected code.",
  explain:
    BASE +
    "Explain Mode: explain code and technical concepts step by step in simple " +
    "terms, with small examples where helpful.",
};

function systemFor(mode: unknown): string {
  return MODES[typeof mode === "string" ? mode : ""] || MODES.coder;
}

type Msg = { role: string; content: string; };

export async function GET() {
  return NextResponse.json({ ok: true, engine: "xr-code-hosted" });
}

export async function POST(req: Request) {
  let body: { messages?: Msg[]; mode?: string } | null = null;
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
        messages: [{ role: "assistant", content: systemFor(body?.mode) }, ...safe],
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

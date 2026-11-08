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
    "QnA Mode: answer any type of question — general knowledge, facts, concepts, advice. " +
    "Lead with the direct answer, then a few short supporting facts.",
  debug:
    BASE +
    "Debug Mode: analyze errors, stack traces and broken output. " +
    "Name the root cause first, then give the exact fix as code.",
  explain:
    BASE +
    "Explain Mode: break down code, concepts and errors step by step in simple words. " +
    "Use short numbered steps.",
};

function systemFor(mode: unknown): string {
  return MODES[typeof mode === "string" ? mode : ""] || MODES.coder;
}

// QnA Mode rides on live web results: reply like the top Google result,
// lightly rephrased so it is not a verbatim copy.
async function googleContext(q: string): Promise<string> {
  try {
    const zai = await ZAI.create();
    const res = await zai.functions.invoke("web_search", {
      query: q.slice(0, 300),
      num: 8,
    });
    const items = (Array.isArray(res) ? res : []).slice(0, 6);
    if (!items.length) return "";
    const lines = items.map(
      (it, i) =>
        `${i + 1}. ${it.name}${it.date ? ` (${it.date})` : ""}\n` +
        `   ${String(it.snippet || "").slice(0, 400)}\n` +
        `   source: ${it.url}`
    );
    return (
      "\n\nLIVE WEB RESULTS for this question:\n" +
      lines.join("\n") +
      "\n\nQnA answering rules: base your reply on these results. " +
      "Give the answer the way the top Google result would read — same facts, " +
      "but with light grammar and wording changes so it is not a verbatim copy. " +
      "Be direct and concise, no markdown headings. " +
      "End with a final line 'Sources:' followed by up to 3 of the result URLs."
    );
  } catch {
    return ""; // search down → plain QnA answer, never block the chat
  }
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

  let sys = systemFor(body?.mode);
  if (body?.mode === "qna") {
    const lastUser = [...safe].reverse().find(m => m.role === "user");
    if (lastUser) sys += await googleContext(lastUser.content);
  }

  let lastErr = "ai error";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [{ role: "assistant", content: sys }, ...safe],
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

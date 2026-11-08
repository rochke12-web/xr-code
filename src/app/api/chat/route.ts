import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

// XR-Space hosted brain — no API keys, no modes, nothing to configure.
// One unified agent: it reads each message and automatically does the right thing —
// writes code, debugs errors, explains, or answers any question (riding live web
// results when the message looks like a knowledge / current-info question).
// GET  /api/chat → health probe { ok: true } for the status bar
// POST /api/chat → { messages } → { ok, text } | { ok:false, error }

const SYSTEM =
  "You are XR-Space, the built-in AI of the XR-Space app by YUX FF. " +
  "There are no modes — read every message and automatically do the right thing: " +
  "• Coding requests: plan in one short line, then give complete, runnable code in fenced blocks with the language tag. " +
  "• Errors or stack traces: name the root cause first, then give the exact fix as code. " +
  "• Explanations: break it down in short numbered steps in simple words. " +
  "• Any question (facts, knowledge, advice, current events): lead with the direct answer, then a few short supporting facts. " +
  "When LIVE WEB RESULTS are attached below, base factual replies on them and end with a final line " +
  "'Sources:' followed by up to 3 of the result URLs. " +
  "Keep answers concise, plain text, no markdown headings. ";

// light heuristic: does this message deserve live web results?
// questions, fact lookups, current info — yes. code requests — no.
function wantsWeb(q: string): boolean {
  const s = q.toLowerCase();
  if (s.length < 4) return false;
  const isAsk =
    /\?\s*$/.test(s) ||
    /^(who|what|when|where|why|how|which|whose|is|are|was|were|do|does|did|can|could|should|define|explain|tell me about)\b/.test(s) ||
    /(latest|current|today|right now|news|price of|net worth|population|how old|release date|who is|what is)/.test(s);
  if (!isAsk) return false;
  // pure code tasks never search, even if phrased oddly long
  if (/^(write|create|make|build|fix|refactor|optimi[sz]e|implement|add)\b/.test(s) && !s.includes("?") && !/who is|what is|latest|current|news/.test(s)) return false;
  return true;
}

// rides on live web results: reply like the top Google result, lightly rephrased
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
      "\n\nAnswering rules: base your reply on these results. " +
      "Give the answer the way the top Google result would read — same facts, " +
      "but with light grammar and wording changes so it is not a verbatim copy. " +
      "Be direct and concise, no markdown headings. " +
      "End with a final line 'Sources:' followed by up to 3 of the result URLs."
    );
  } catch {
    return ""; // search down → answer from the model itself, never block the chat
  }
}

type Msg = { role: string; content: string; };

export async function GET() {
  return NextResponse.json({ ok: true, engine: "xr-space-hosted" });
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

  let sys = SYSTEM;
  const lastUser = [...safe].reverse().find(m => m.role === "user");
  if (lastUser && wantsWeb(lastUser.content)) {
    sys += await googleContext(lastUser.content);
  }

  let lastErr = "ai error";
  for (let attempt = 0; attempt < 3; attempt++) {
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
    }
    // upstream busy / throttled / blipped — back off and try again
    if (attempt < 2) await new Promise(r => setTimeout(r, attempt === 0 ? 5000 : 15000));
  }
  return NextResponse.json({ ok: false, error: lastErr });
}

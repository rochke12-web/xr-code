import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

// XR-Space hosted brain — no API keys, no modes, nothing to configure.
// One highly capable agent: reads each message and automatically responds the
// best way — complete runnable code, precise debugging, clear explanations, or
// direct answers to any question (riding live web results when useful).
// Thinking mode is ON: the model reasons before answering, we show only the result.
// GET  /api/chat → health probe { ok: true } for the status bar
// POST /api/chat → { messages } → { ok, text } | { ok:false, error }

const SYSTEM =
  "You are XR Code, the AI of the XR-Code app by YUX FF — one highly capable agent. " +
  "There are no modes: read every message and automatically respond in the most helpful way. " +
  "Core behavior: " +
  "• Think before answering — silently plan the solution, weigh edge cases, then answer. " +
  "Never reveal private reasoning, only the polished result. " +
  "• Coding: give complete, runnable, production-quality code in fenced blocks with the language tag. " +
  "Handle edge cases, use modern best practices, keep comments short and useful. " +
  "If the request is ambiguous, pick the most sensible interpretation and say so in one line. " +
  "• Debugging: name the exact root cause in one or two sentences, then give the corrected code. " +
  "• Explanations: simple and accurate, step by step, with one concrete example. " +
  "• Any question (facts, knowledge, advice, current events): lead with the direct answer in the first " +
  "sentence, then a few crisp supporting facts. When live results are attached, base the reply on them — " +
  "answer the way the top result would read, with light grammar and wording changes so it is not a verbatim copy. " +
  "When LIVE WEB RESULTS are attached, use them to ground factual replies, but keep the reply clean — " +
  "do NOT add any Sources line by default. Only when the user explicitly asks for sources, references " +
  "or links, end with a final line 'Sources:' followed by up to 3 of the result URLs. " +
  "Match the user's language and calibrate depth: short question → short crisp answer; " +
  "big task → structured, thorough answer. Plain text, no markdown headings; " +
  "short lists and fenced code blocks are fine. ";

// does this message deserve live web results?
// knowledge / current-info questions — yes. pure code tasks and math/reasoning — no.
function wantsWeb(q: string): boolean {
  const s = q.toLowerCase();
  if (s.length < 4) return false;
  // identity / meta questions about the AI itself — answer directly, never search
  if (/(who are you|what are you|your name|who made you|who created you|who built you|about yourself|who are u)/.test(s)) return false;
  const questionWord = /^(who|what|when|where|why|how|which|whose|is|are|was|were|do|does|did|can|could|should|define|explain|tell me about)\b/.test(s);
  const currentInfo = /(latest|current|today|right now|news|price of|net worth|population|how old|release date|who is|what is)/.test(s);
  const followUp = /^(and|also|his|her|its|their|what about|how about)\b/.test(s) && s.includes("?");
  if (!(questionWord || currentInfo || followUp)) return false;
  // pure code tasks never search, even if phrased oddly long
  if (/^(write|create|make|build|fix|refactor|optimi[sz]e|implement|add)\b/.test(s) && !s.includes("?") && !/who is|what is|latest|current|news/.test(s)) return false;
  return true;
}

// context-aware search query: short follow-ups like "how old is he?" inherit
// the previous question's topic so the search still finds the right thing.
function searchQuery(safe: Msg[]): string {
  const users = safe.filter(m => m.role === "user");
  const last = (users[users.length - 1]?.content ?? "").trim();
  if (
    users.length >= 2 &&
    (last.length < 45 || /^(and|also|his|her|its|their|what about|how about|then|so)\b/i.test(last))
  ) {
    const prev = users[users.length - 2].content.slice(0, 120);
    return `${prev} ${last}`.slice(0, 300);
  }
  return last.slice(0, 300);
}

// rides on live web results: reply like the top Google result, lightly rephrased
async function googleContext(q: string): Promise<string> {
  try {
    const zai = await ZAI.create();
    const res = await zai.functions.invoke("web_search", {
      query: q.slice(0, 300),
      num: 10,
    });
    const items = (Array.isArray(res) ? res : []).slice(0, 8);
    if (!items.length) return "";
    const lines = items.map(
      (it, i) =>
        `${i + 1}. ${it.name}${it.date ? ` (${it.date})` : ""}\n` +
        `   ${String(it.snippet || "").slice(0, 500)}\n` +
        `   source: ${it.url}`
    );
    return (
      "\n\nLIVE WEB RESULTS for this question:\n" +
      lines.join("\n") +
      "\n\nAnswering rules: base your reply on these results. " +
      "Give the answer the way the top Google result would read — same facts, " +
      "but with light grammar and wording changes so it is not a verbatim copy. " +
      "Be direct and concise, no markdown headings. " +
      "Do not add a Sources line unless the user explicitly asked for sources."
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
        .slice(-24)
        .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .map(m => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 8000) }))
    : [];
  if (!safe.length) {
    return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
  }

  let sys = SYSTEM;
  const lastUser = [...safe].reverse().find(m => m.role === "user");
  if (lastUser && wantsWeb(lastUser.content)) {
    sys += await googleContext(searchQuery(safe));
    if (/\b(sources?|cite|citations?|references?|links?|urls?)\b/i.test(lastUser.content)) {
      sys += "\n\nThe user explicitly asked for sources: end your reply with a final line 'Sources:' " +
             "followed by up to 3 of the LIVE WEB RESULTS URLs above.";
    }
  }

  let lastErr = "ai error";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [{ role: "assistant", content: sys }, ...safe],
        thinking: { type: "enabled" },   // reason before answering — big quality lift
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

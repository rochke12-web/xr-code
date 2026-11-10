import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Hosted chat proxy — the browser never sees or sends the API key.
// The server reads the key stored (once) in the database, calls Z.ai,
// auto-retries HTTP 429 (rate limit) twice, and returns a clean JSON result.

const ZAI_URL = "https://api.z.ai/api/paas/v4/chat/completions";
const WAITS = [3000, 8000]; // auto-retry pauses for HTTP 429

type Msg = { role: string; content: string };

function cleanKey(raw: string): string {
  return String(raw || "")
    .replace(/\s+/g, "")            // spaces, tabs, NBSP…
    .replace(/[^\x21-\x7E]/g, "");  // Authorization header must be plain ASCII
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
        .map(m => ({ role: m.role, content: m.content.slice(0, 8000) }))
    : [];
  if (!safe.length) {
    return NextResponse.json({ ok: false, status: 400, error: "bad request" });
  }

  let row: { apiKey: string; model: string } | null = null;
  try {
    row = await db.hostConfig.findUnique({ where: { provider: "zai" } });
  } catch {
    row = null;
  }
  if (!row) {
    return NextResponse.json({ ok: false, status: 503, error: "not hosted" });
  }
  const key = cleanKey(row.apiKey);

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(ZAI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + key,
        },
        body: JSON.stringify({ model: row.model || "glm-4.6", messages: safe, stream: false }),
        signal: AbortSignal.timeout(45000),
      });
    } catch {
      return NextResponse.json({ ok: false, status: 0, error: "network error" });
    }
    if (res.status === 429 && attempt < WAITS.length) {
      await new Promise(r => setTimeout(r, WAITS[attempt]));
      continue;
    }
    if (!res.ok) {
      return NextResponse.json({ ok: false, status: res.status, error: "HTTP " + res.status });
    }
    let out = "";
    try {
      const data = await res.json();
      out = String(data?.choices?.[0]?.message?.content ?? "");
    } catch {
      return NextResponse.json({ ok: false, status: 502, error: "bad gateway" });
    }
    const t = out.trim();
    if (!t) return NextResponse.json({ ok: false, status: 502, error: "empty reply" });
    return NextResponse.json({ ok: true, model: row.model || "glm-4.6", text: t });
  }
}

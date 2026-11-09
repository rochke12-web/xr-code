import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Cloud copy of the chats, keyed by the linked Discord user id.
// GET  → { ok, chats, ts }          (chats is null when nothing saved yet)
// POST → { chats, active } saved    (only for a valid session, 2.5 MB cap)

function cookieVal(req: Request, name: string): string {
  const c = req.headers.get("cookie") || "";
  for (const part of c.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return "";
}

async function sessionId(req: Request): Promise<string | null> {
  const sid = cookieVal(req, "xr_sess");
  if (!sid || !/^[a-f0-9]{48}$/.test(sid)) return null;
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "data", "sessions", sid + ".json"), "utf8");
    const s = JSON.parse(raw);
    const id = String(s.id || "");
    return /^\d{5,25}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function fileFor(id: string): string {
  return path.join(process.cwd(), "data", "discord", id + ".json");
}

export async function GET(req: Request) {
  const id = await sessionId(req);
  if (!id) return NextResponse.json({ ok: true, chats: null });
  try {
    const raw = await fs.readFile(fileFor(id), "utf8");
    const d = JSON.parse(raw);
    return NextResponse.json({ ok: true, chats: d.chats ?? null, ts: d.ts ?? null });
  } catch {
    return NextResponse.json({ ok: true, chats: null });
  }
}

export async function POST(req: Request) {
  const id = await sessionId(req);
  if (!id) return NextResponse.json({ ok: false, error: "not linked" }, { status: 401 });
  let body: { chats?: unknown; active?: unknown } | null = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad body" }, { status: 400 });
  }
  if (!body || !Array.isArray(body.chats)) {
    return NextResponse.json({ ok: false, error: "bad chats" }, { status: 400 });
  }
  const payload = JSON.stringify({ chats: body.chats, active: body.active ?? 0, ts: Date.now() });
  if (payload.length > 2_500_000) {
    return NextResponse.json({ ok: false, error: "too large" }, { status: 413 });
  }
  try {
    await fs.mkdir(path.join(process.cwd(), "data", "discord"), { recursive: true });
    await fs.writeFile(fileFor(id), payload);
    return NextResponse.json({ ok: true, ts: Date.now() });
  } catch {
    return NextResponse.json({ ok: false, error: "disk" }, { status: 500 });
  }
}

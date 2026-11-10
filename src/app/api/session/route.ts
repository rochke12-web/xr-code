import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Who is linked right now? Read the HttpOnly session cookie and resolve it
// against the session file on disk. Never exposes tokens.

function cookieVal(req: Request, name: string): string {
  const c = req.headers.get("cookie") || "";
  for (const part of c.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return "";
}

export async function GET(req: Request) {
  const sid = cookieVal(req, "xr_sess");
  if (!sid || !/^[a-f0-9]{48}$/.test(sid)) return NextResponse.json({ ok: true, user: null });
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "data", "sessions", sid + ".json"), "utf8");
    const s = JSON.parse(raw);
    return NextResponse.json({ ok: true, user: { id: s.id, name: s.name, avatar: s.avatar } });
  } catch {
    return NextResponse.json({ ok: true, user: null });
  }
}

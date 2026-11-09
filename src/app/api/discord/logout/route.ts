import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Unlink: drop the server session (the cloud backup stays — progress is not deleted).

function cookieVal(req: Request, name: string): string {
  const c = req.headers.get("cookie") || "";
  for (const part of c.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return "";
}

export async function POST(req: Request) {
  const sid = cookieVal(req, "xr_sess");
  if (sid && /^[a-f0-9]{48}$/.test(sid)) {
    try {
      await fs.unlink(path.join(process.cwd(), "data", "sessions", sid + ".json"));
    } catch {
      /* already gone */
    }
  }
  const res = NextResponse.json({ ok: true });
  res.headers.append("Set-Cookie", "xr_sess=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  return res;
}

// Verification check — the client pings this on load (and the settings page uses it).
// Reads the signed HttpOnly cookie; no Discord secrets or tokens here.
import { NextResponse } from "next/server";
import { verifyDiscord } from "@/lib/xrauth";

export async function POST(req: Request) {
  const invite = process.env.DISCORD_INVITE || "";
  if (!process.env.DISCORD_CLIENT_SECRET) {
    return NextResponse.json({ ok: false, error: "setup", invite });
  }
  const v = verifyDiscord(req);
  if (!v.ok) return NextResponse.json({ ok: false, error: v.error || "verify", invite });
  return NextResponse.json({ ok: true, uid: v.uid, invite });
}

export async function GET(req: Request) {
  return POST(req);
}

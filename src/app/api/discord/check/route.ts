// Verification check — the client pings this on load (and the settings page uses it).
// Reads the signed HttpOnly cookie; no Discord secrets or tokens here.
import { NextResponse } from "next/server";
import { verifyDiscord } from "@/lib/xrauth";
import { XR_SECRETS } from "@/lib/xrsecrets";
import { pinnedRoleId, isRecentOwner } from "@/lib/xrverify";

export async function POST(req: Request) {
  // invite is public info — hardcoded fallback so "Join the XR server" can
  // never end up as a dead '#' link that opens the app's own tab
  const invite = process.env.DISCORD_INVITE || XR_SECRETS.DISCORD_INVITE;
  if (!process.env.DISCORD_CLIENT_SECRET && !XR_SECRETS.DISCORD_CLIENT_SECRET) {
    return NextResponse.json({ ok: false, error: "setup", invite });
  }
  const v = verifyDiscord(req);
  // the linked XR-Auth role id (null while unpinned) — not a secret; lets the
  // owner confirm the link worked without opening any Discord menus. `owner`
  // = this session proved guild ownership recently — it unlocks the in-app
  // Role-ID link box in Settings → Accounts.
  const roleId = (await pinnedRoleId().catch(() => "")) || null;
  if (!v.ok) return NextResponse.json({ ok: false, error: v.error || "verify", invite, roleId });
  return NextResponse.json({ ok: true, uid: v.uid, invite, roleId, owner: v.uid ? isRecentOwner(v.uid) : false });
}

export async function GET(req: Request) {
  return POST(req);
}

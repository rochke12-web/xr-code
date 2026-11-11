// Owner self-service: link the XR-Auth role id. The caller must carry a valid
// verification cookie AND have proven guild ownership at verify time (within
// the owner-mark TTL — just tap Verify with Discord again if it lapsed).
// The role id itself is pasted from Discord (Server Settings → Roles →
// right-click XR-Auth → Copy Role ID): user OAuth tokens cannot read a
// guild's role list (bot-only endpoint), so there is nothing to auto-detect.
import { NextResponse } from "next/server";
import { verifyDiscord } from "@/lib/xrauth";
import { pinRoleByOwner, pinnedRoleId } from "@/lib/xrverify";

export async function POST(req: Request) {
  const v = verifyDiscord(req);
  if (!v.ok || !v.uid) return NextResponse.json({ ok: false, error: "verify" }, { status: 401 });
  let body: { roleId?: unknown } = {};
  try { body = await req.json(); } catch { /* handled below */ }
  const r = await pinRoleByOwner(v.uid, String(body.roleId || ""));
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.error || "pin" }, { status: r.error === "owner" ? 403 : 400 });
  }
  // confirm what the gate will actually use from now on
  const roleId = await pinnedRoleId().catch(() => "");
  return NextResponse.json({ ok: true, roleId: roleId || null });
}

// Manual verification handoff — the escape hatch for "Invalid OAuth2
// redirect_uri". When Discord rejects this deployment's automatic redirect
// (not registered in the portal), the user authorizes with the registered
// localhost redirect instead, the browser lands on a dead localhost page,
// and they paste that full address here. The code inside is exchanged
// server-side exactly like the automatic callback.
import { NextResponse } from "next/server";
import { mintToken, authCookie } from "@/lib/xrauth";
import { exchangeAndVerify } from "@/lib/xrverify";

const LOCAL = process.env.DISCORD_LOCAL_REDIRECT || "http://localhost:3000";

export async function POST(req: Request) {
  let body: { url?: string } | null = null;
  try { body = await req.json(); } catch { /* bad json */ }
  const raw = (body?.url || "").trim();
  let u: URL;
  try { u = new URL(raw); } catch {
    return NextResponse.json({ ok: false, error: "paste" }, { status: 400 });
  }
  if (u.searchParams.get("error")) {
    return NextResponse.json({ ok: false, error: "denied" });  // user pressed Cancel
  }
  const code = u.searchParams.get("code") || "";
  if (!code) return NextResponse.json({ ok: false, error: "paste" }, { status: 400 });
  // only two redirect bases are legitimate: the registered localhost one and
  // this deployment's own origin — anything else is not our callback
  const self = new URL(req.url).origin;
  const allowed = new Set([LOCAL, self]);
  if (!allowed.has(u.origin)) {
    return NextResponse.json({ ok: false, error: "paste" }, { status: 400 });
  }
  const v = await exchangeAndVerify(code, u.origin + "/auth/discord/callback");
  if (!v.ok) return NextResponse.json({ ok: false, error: v.error });
  const res = NextResponse.json({ ok: true, uid: v.uid });
  res.headers.set("Set-Cookie", authCookie(mintToken(v.uid)));
  return res;
}

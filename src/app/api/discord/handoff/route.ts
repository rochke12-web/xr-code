// Manual verification handoff — the escape hatch for "Invalid OAuth2
// redirect_uri". When Discord rejects this deployment's automatic redirect
// (not registered in the portal), the user authorizes with the registered
// localhost redirect instead, the browser lands on a dead localhost page,
// and they paste that full address here. The code inside is exchanged
// server-side exactly like the automatic callback.
//
// Token mode: the cross-origin popup flow lands on /auth/discord/handoff with
// a one-time signed token in the URL fragment; this endpoint exchanges it for
// a LOCAL verification cookie. CSRF-safe: the token is bound to the OAuth
// state random and this origin must still hold the matching xr_state cookie
// (set by /auth/discord/start in the same popup, same browser).
import { NextResponse } from "next/server";
import { mintToken, authCookie, verifyHandoff } from "@/lib/xrauth";
import { exchangeAndVerify } from "@/lib/xrverify";
import { originOf } from "@/lib/xrorigins";

const LOCAL = process.env.DISCORD_LOCAL_REDIRECT || "http://localhost:3000";

function cookieVal(req: Request, name: string): string {
  return (
    (req.headers.get("cookie") || "")
      .split(/;\s*/)
      .map(p => p.split("="))
      .find(p => p[0] === name)?.[1] || ""
  );
}

function tokenHandoff(req: Request, token: string) {
  const v = verifyHandoff(token);
  if (!v.ok) return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
  const state = cookieVal(req, "xr_state");
  if (!state || !v.rand || state !== v.rand) {
    // no matching session on THIS origin -> replay / foreign browser / expired
    return NextResponse.json({ ok: false, error: "state" }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true, uid: v.uid });
  res.headers.set("Set-Cookie", authCookie(mintToken(v.uid!)));
  // burn the state cookie — the handoff is strictly one-time
  res.headers.append("Set-Cookie", "xr_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  return res;
}

export async function POST(req: Request) {
  let body: { url?: string; token?: string } | null = null;
  try { body = await req.json(); } catch { /* bad json */ }
  if (body && typeof body.token === "string" && body.token) {
    return tokenHandoff(req, body.token);
  }
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
  // (originOf, NOT raw req.url — the brain rewrites req.url to 0.0.0.0:3000)
  const self = originOf(req);
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

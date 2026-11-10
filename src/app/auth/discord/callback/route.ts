// Discord OAuth callback — the code never touches the browser.
// Exchange -> identify -> membership check in the owner's server ->
// verified member ? mint cookie : bounce back with an error code.
// CSRF state from /auth/discord/start is validated before anything else
// (handoff invariant 5) — a state mismatch bounces with dserr=state.
import { NextResponse } from "next/server";
import { mintToken, authCookie } from "@/lib/xrauth";
import { exchangeAndVerify } from "@/lib/xrverify";

function fail(req: Request, code: string) {
  return NextResponse.redirect(new URL("/?dserr=" + code, req.url));
}

// same origin derivation as /auth/discord/start so the redirect_uri the code
// was issued for matches exactly (proxy headers can rewrite the host)
function originOf(req: Request): string {
  const u = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || u.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || u.host;
  return `${proto}://${host}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = url.searchParams.get("state") || "";
  const cookieState = (req.headers.get("cookie") || "")
    .split(/;\s*/)
    .map(p => p.split("="))
    .find(p => p[0] === "xr_state")?.[1] || "";
  if (!state || !cookieState || state !== cookieState) return fail(req, "state");
  const code = url.searchParams.get("code") || "";
  if (!code) return fail(req, "setup");
  const v = await exchangeAndVerify(code, originOf(req) + "/auth/discord/callback");
  if (!v.ok) return fail(req, v.error);
  const res = NextResponse.redirect(new URL("/?dsok=1", req.url));
  res.headers.set("Set-Cookie", authCookie(mintToken(v.uid)));
  // burn the state cookie — one-time use
  res.headers.append("Set-Cookie", "xr_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  return res;
}

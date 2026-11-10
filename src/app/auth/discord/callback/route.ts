// Discord OAuth callback — the code never touches the browser.
// Exchange -> identify -> membership check in the owner's server ->
// verified member ? mint cookie : bounce back with an error code.
//
// CSRF state from /auth/discord/start is validated before anything else
// (handoff invariant 5) — a state mismatch bounces with dserr=state.
// When the state carries a ret origin (cross-origin popup flow) the state
// cookie check moves to the ret origin's handoff endpoint, which re-checks
// the same random against its own cookie before minting anything.
import { NextResponse } from "next/server";
import { mintToken, mintHandoff, authCookie } from "@/lib/xrauth";
import { exchangeAndVerify } from "@/lib/xrverify";
import { XR_SECRETS } from "@/lib/xrsecrets";
import { safeOrigin, unb64u, originOf } from "@/lib/xrorigins";

// Same-origin bounce: a RELATIVE Location header. Browsers resolve it against
// the URL they actually navigated to (the public origin), so no internal bind
// address (http://0.0.0.0:3000 on the brain) can ever leak into the address bar.
function seeOther(location: string, cookies: string[] = []) {
  const h = new Headers({ Location: location });
  cookies.forEach(c => h.append("Set-Cookie", c));
  return new Response(null, { status: 302, headers: h });
}

function fail(req: Request, code: string, retOrigin?: string) {
  if (retOrigin && retOrigin !== originOf(req)) {
    // cross-origin popup: send the error to the tiny handoff page on the
    // browsing origin so the popup explains itself instead of loading the
    // whole app on the pinned origin
    return NextResponse.redirect(new URL("/auth/discord/handoff#e=" + encodeURIComponent(code), retOrigin));
  }
  return seeOther("/?dserr=" + encodeURIComponent(code));
}

function cookieVal(req: Request, name: string): string {
  return (
    (req.headers.get("cookie") || "")
      .split(/;\s*/)
      .map(p => p.split("="))
      .find(p => p[0] === name)?.[1] || ""
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  // same resolver as /auth/discord/start — forwarded headers first, because
  // req.url on the hosted brain is the internal bind address, which would
  // misclassify every flow as cross-origin and bounce redirects to 0.0.0.0
  const selfOrigin = originOf(req);

  // state = rand (same-origin flow) | rand.b64url(retOrigin) (cross-origin popup)
  const rawState = url.searchParams.get("state") || "";
  const dot = rawState.indexOf(".");
  let rand = rawState;
  let retRaw = "";
  if (dot > 0) {
    rand = rawState.slice(0, dot);
    retRaw = unb64u(rawState.slice(dot + 1));
  }
  const retOrigin = (retRaw && safeOrigin(retRaw)) || selfOrigin;

  // validate the session BEFORE touching the code (handoff invariant 5)
  if (retOrigin === selfOrigin) {
    // flow started on this origin — strict cookie check here
    const cookieState = cookieVal(req, "xr_state");
    if (!rand || !cookieState || rand !== cookieState) return fail(req, "state", retOrigin);
  } else if (!rand) {
    return fail(req, "state", retOrigin);
  }

  if (url.searchParams.get("error")) {
    // user pressed Cancel on the consent screen (or Discord refused the client)
    const d = url.searchParams.get("error");
    return fail(req, d === "access_denied" ? "denied" : "state", retOrigin);
  }

  const code = url.searchParams.get("code") || "";
  if (!code) return fail(req, "setup", retOrigin);

  // same pinned origin as /auth/discord/start — the exchange redirect_uri must
  // match the one the code was issued for exactly (gateway headers can lie)
  const origin = process.env.DISCORD_REDIRECT_ORIGIN || XR_SECRETS.DISCORD_REDIRECT_ORIGIN;
  const v = await exchangeAndVerify(code, origin + "/auth/discord/callback");
  if (!v.ok) return fail(req, v.error, retOrigin);

  // burn the state cookie — one-time use (same-origin flow only has it here;
  // the cross-origin flow burns its own copy in the handoff endpoint)
  const burn = "xr_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";

  if (retOrigin !== selfOrigin) {
    // hand the verification to the browsing origin: one-time signed token in
    // the fragment (never sent to any server). The pinned origin ALSO gets the
    // real cookie — a direct visit there is verified from now on too.
    const res = NextResponse.redirect(
      new URL("/auth/discord/handoff#h=" + mintHandoff(v.uid, rand), retOrigin)
    );
    res.headers.set("Set-Cookie", authCookie(mintToken(v.uid)));
    return res;
  }

  const popup = cookieVal(req, "xr_popup") === "1";
  const res = seeOther(popup ? "/auth/discord/done" : "/?dsok=1", [
    authCookie(mintToken(v.uid)),
    burn,
  ]);
  return res;
}

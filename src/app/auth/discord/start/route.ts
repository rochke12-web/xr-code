import { NextResponse } from "next/server";
import crypto from "crypto";
import { XR_SECRETS } from "@/lib/xrsecrets";
import { safeOrigin, b64u, originOf } from "@/lib/xrorigins";

// Step 1 of the Discord OAuth (authorization-code flow):
// bounce the user to Discord's consent screen with a CSRF state cookie.
//
// The app UI always renders inside the shell's srcdoc iframe, and the shell
// can be served under an origin that is NOT the pinned OAuth origin (the Z.ai
// preview panel uses its own subdomain; the pinned origin is the one whose
// callback URL is registered in the Discord portal). Navigating the iframe to
// Discord is impossible (X-Frame-Options: refused to connect), so the client
// opens a POPUP here and may pass `ret` = the origin it is browsing. When ret
// differs from the pinned origin the state carries it along (rand.b64url(ret))
// and the callback hands the verification back via a one-time handoff token.

function originOfReq(req: Request): string {
  return originOf(req);
}

export async function GET(req: Request) {
  const cid = process.env.DISCORD_CLIENT_ID || XR_SECRETS.DISCORD_CLIENT_ID;
  // redirect_uri MUST match one registered in the Discord developer console.
  // Gateway headers can expose an internal FC host, so a pinned origin wins
  // when configured (set on the hosted deployment; unset on localhost dev).
  const origin = process.env.DISCORD_REDIRECT_ORIGIN || XR_SECRETS.DISCORD_REDIRECT_ORIGIN || originOfReq(req);
  const url = new URL(req.url);
  const ret = safeOrigin(url.searchParams.get("ret") || "") || origin;
  const popup = url.searchParams.get("popup") === "1";
  const rand = crypto.randomBytes(16).toString("hex");
  // cross-origin popup: carry the ret origin inside the state (Discord echoes
  // it verbatim); same-origin flow keeps the plain random (back-compat)
  const state = ret !== origin ? rand + "." + b64u(ret) : rand;
  const params = new URLSearchParams({
    client_id: cid,
    response_type: "code",
    redirect_uri: origin + "/auth/discord/callback",
    // identify: who the user is · guilds.members.read: the member record
    // (pending flag + roles) · guilds: owner check · manage_guild: lets the
    // SERVER OWNER's own token link the XR-Auth role by name at verify time
    // (members without the permission simply can't use it — Discord rejects
    // the roles read for them)
    scope: "identify guilds guilds.members.read manage_guild",
    state,
    // force the consent screen so a re-authorization picks up scope CHANGES:
    // Discord silently re-issues the previously granted scope set otherwise,
    // which left the `guilds` scope (owner check) off for early authorizers
    prompt: "consent",
  });
  const res = NextResponse.redirect("https://discord.com/oauth2/authorize?" + params.toString(), 302);
  res.headers.append("Set-Cookie", `xr_state=${rand}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);
  if (popup) {
    // the callback reads this on the start origin to send same-origin popups
    // to the tiny self-closing "done" page instead of the full app
    res.headers.append("Set-Cookie", "xr_popup=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=600");
  }
  return res;
}

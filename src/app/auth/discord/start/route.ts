import { NextResponse } from "next/server";
import crypto from "crypto";
import { XR_SECRETS } from "@/lib/xrsecrets";

// Step 1 of the Discord OAuth (authorization-code flow):
// bounce the user to Discord's consent screen with a CSRF state cookie.
// The redirect_uri is derived from the host the user is browsing, so the same
// route works on localhost and on the live preview — as long as BOTH are
// registered in the Discord developer console (OAuth2 → Redirects).

function originOf(req: Request): string {
  const u = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || u.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || u.host;
  return `${proto}://${host}`;
}

export async function GET(req: Request) {
  const cid = process.env.DISCORD_CLIENT_ID || XR_SECRETS.DISCORD_CLIENT_ID;
  // redirect_uri MUST match one registered in the Discord developer portal.
  // Gateway headers can expose an internal FC host, so a pinned origin wins
  // when configured (set on the hosted deployment; unset on localhost dev).
  const origin = process.env.DISCORD_REDIRECT_ORIGIN || originOf(req);
  const state = crypto.randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    client_id: cid,
    response_type: "code",
    redirect_uri: origin + "/auth/discord/callback",
    // identify: who the user is · guilds.members.read: the member record
    // (pending flag + roles) for the XR-Auth role gate. Minimal set.
    scope: "identify guilds.members.read",
    state,
  });
  const res = NextResponse.redirect("https://discord.com/oauth2/authorize?" + params.toString(), 302);
  res.headers.append("Set-Cookie", `xr_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);
  return res;
}

import { NextResponse } from "next/server";
import crypto from "crypto";

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
  const cid = process.env.DISCORD_CLIENT_ID || "1569008720661315645";
  const origin = originOf(req);
  const state = crypto.randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    client_id: cid,
    response_type: "code",
    redirect_uri: origin + "/auth/discord/callback",
    scope: "identify",
    state,
  });
  const res = NextResponse.redirect("https://discord.com/oauth2/authorize?" + params.toString(), 302);
  res.headers.append("Set-Cookie", `xr_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);
  return res;
}

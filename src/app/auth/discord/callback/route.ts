// Discord OAuth callback — the code never touches the browser.
// Exchange -> identify -> membership check in the owner's server ->
// member + verified (screening passed) ? mint cookie : bounce back with an error code.
import { NextResponse } from "next/server";
import { mintToken, authCookie } from "@/lib/xrauth";

const CID = process.env.DISCORD_CLIENT_ID || "1569300109790023772";
const GID = process.env.DISCORD_GUILD_ID || "1568895668368711692";
const SECRET = process.env.DISCORD_CLIENT_SECRET || "";

function fail(req: Request, code: string) {
  return NextResponse.redirect(new URL("/?dserr=" + code, req.url));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") || "";
  if (!SECRET) return fail(req, "setup");
  if (!code) return fail(req, "setup");
  try {
    const tokRes = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CID,
        client_secret: SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: url.origin + "/auth/discord/callback",
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!tokRes.ok) return fail(req, "setup");
    const tok = (await tokRes.json()) as { access_token?: string };
    if (!tok.access_token) return fail(req, "setup");
    const H = { Authorization: "Bearer " + tok.access_token };

    const meRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: H, signal: AbortSignal.timeout(15000),
    });
    if (!meRes.ok) return fail(req, "setup");
    const me = (await meRes.json()) as { id?: string };
    if (!me.id) return fail(req, "setup");

    // membership: prefer the member endpoint (also catches pending screening);
    // fall back to the guild list when the bot is not installed in the server.
    let member = false;
    let pending = false;
    const memRes = await fetch(`https://discord.com/api/v10/users/@me/guilds/${GID}/member`, {
      headers: H, signal: AbortSignal.timeout(15000),
    });
    if (memRes.ok) {
      const mem = (await memRes.json()) as { pending?: boolean };
      member = true;
      pending = !!mem.pending;
    } else if (memRes.status === 404) {
      member = false;
    } else {
      const gRes = await fetch("https://discord.com/api/v10/users/@me/guilds", {
        headers: H, signal: AbortSignal.timeout(15000),
      });
      if (gRes.ok) {
        const guilds = (await gRes.json()) as { id?: string }[];
        member = Array.isArray(guilds) && guilds.some(g => g.id === GID);
      }
    }
    if (!member) return fail(req, "join");
    if (pending) return fail(req, "pending");

    const res = NextResponse.redirect(new URL("/?dsok=1", req.url));
    res.headers.set("Set-Cookie", authCookie(mintToken(me.id)));
    return res;
  } catch {
    return fail(req, "setup");
  }
}

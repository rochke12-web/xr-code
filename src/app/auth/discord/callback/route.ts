// Discord OAuth callback — the code never touches the browser.
// Exchange -> identify -> membership check in the owner's server ->
// verified member ? mint cookie : bounce back with an error code.
// Gate rule (default): joined the server AND passed its member verification
// (not pending). Strict mode: if DISCORD_ROLE_ID or DISCORD_BOT_TOKEN is set,
// the member must also hold the XR-Auth role (or the DISCORD_ROLE_NAME role).
// The /users/@me/guilds/{id}/member endpoint needs the app's bot installed in
// the server — without one we fall back to the guilds list, which needs no bot.
import { NextResponse } from "next/server";
import { mintToken, authCookie } from "@/lib/xrauth";

const CID = process.env.DISCORD_CLIENT_ID || "1569300109790023772";
const GID = process.env.DISCORD_GUILD_ID || "1568895668368711692";
const SECRET = process.env.DISCORD_CLIENT_SECRET || "";
const BOT = process.env.DISCORD_BOT_TOKEN || "";
const ROLE_ID = process.env.DISCORD_ROLE_ID || "";
const ROLE_NAME = (process.env.DISCORD_ROLE_NAME || "XR-Auth").trim().toLowerCase();

// role id lookup by name (needs the bot in the server) — cached 10 minutes
let roleCache: { id: string; at: number } | null = null;
async function targetRoleId(): Promise<string> {
  if (ROLE_ID) return ROLE_ID;
  if (roleCache && Date.now() - roleCache.at < 600_000) return roleCache.id;
  if (!BOT) return "";
  const r = await fetch(`https://discord.com/api/v10/guilds/${GID}/roles`, {
    headers: { Authorization: `Bot ${BOT}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) return "";
  const roles = (await r.json()) as { id?: string; name?: string }[];
  const hit = (Array.isArray(roles) ? roles : []).find(
    x => x && typeof x.name === "string" && x.name.trim().toLowerCase() === ROLE_NAME
  );
  if (hit?.id) roleCache = { id: hit.id, at: Date.now() };
  return hit?.id || "";
}

// strict mode only when the owner configured a role — plain membership is
// enough otherwise ("join my server and get member verified" rule)
async function roleGate(roles: string[]): Promise<string | null> {
  if (!ROLE_ID && !BOT) return null;
  const target = await targetRoleId();
  if (!target) return "roleconf";
  return roles.includes(target) ? null : "role";
}

function fail(req: Request, code: string) {
  return NextResponse.redirect(new URL("/?dserr=" + code, req.url));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") || "";
  if (!SECRET || !code) return fail(req, "setup");
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

    let verified = false;
    // best path: member object — gives pending (screening) + roles
    const memRes = await fetch(`https://discord.com/api/v10/users/@me/guilds/${GID}/member`, {
      headers: H, signal: AbortSignal.timeout(15000),
    });
    if (memRes.ok) {
      const mem = (await memRes.json()) as { pending?: boolean; roles?: string[] };
      if (mem.pending) return fail(req, "pending");        // hasn't finished the server's verification steps
      const rerr = await roleGate(Array.isArray(mem.roles) ? mem.roles : []);
      if (rerr) return fail(req, rerr);
      verified = true;
    } else if (memRes.status === 404) {
      return fail(req, "join");                            // simply not in the server
    } else {
      // no bot in the server (403 etc.) — fall back to the plain guilds list
      const gRes = await fetch("https://discord.com/api/v10/users/@me/guilds", {
        headers: H, signal: AbortSignal.timeout(15000),
      });
      if (!gRes.ok) return fail(req, "join");
      const guilds = (await gRes.json()) as { id?: string }[];
      const inGuild = (Array.isArray(guilds) ? guilds : []).some(g => g && g.id === GID);
      if (!inGuild) return fail(req, "join");
      const rerr = await roleGate([]);                     // roles unknown without the member object
      if (rerr) return fail(req, rerr);
      verified = true;
    }
    if (!verified) return fail(req, "join");

    const res = NextResponse.redirect(new URL("/?dsok=1", req.url));
    res.headers.set("Set-Cookie", authCookie(mintToken(me.id)));
    return res;
  } catch {
    return fail(req, "setup");
  }
}

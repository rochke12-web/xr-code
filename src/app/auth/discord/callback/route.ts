// Discord OAuth callback — the code never touches the browser.
// Exchange -> identify -> membership + role check in the owner's server ->
// member with the XR-Auth role ? mint cookie : bounce back with an error code.
// Role resolution: DISCORD_ROLE_ID if set, otherwise look up a role by name
// (DISCORD_ROLE_NAME, default "XR-Auth") through the bot token.
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

    // membership + roles — the member endpoint needs the app's bot installed in the server
    const memRes = await fetch(`https://discord.com/api/v10/users/@me/guilds/${GID}/member`, {
      headers: H, signal: AbortSignal.timeout(15000),
    });
    if (memRes.status === 404) return fail(req, "join");
    if (!memRes.ok) return fail(req, "roleconf");
    const mem = (await memRes.json()) as { pending?: boolean; roles?: string[] };
    if (mem.pending) return fail(req, "pending");

    // the gate: no XR-Auth role -> no AI, even inside the server
    const target = await targetRoleId();
    if (!target) return fail(req, "roleconf");
    const roles = Array.isArray(mem.roles) ? mem.roles : [];
    if (!roles.includes(target)) return fail(req, "role");

    const res = NextResponse.redirect(new URL("/?dsok=1", req.url));
    res.headers.set("Set-Cookie", authCookie(mintToken(me.id)));
    return res;
  } catch {
    return fail(req, "setup");
  }
}

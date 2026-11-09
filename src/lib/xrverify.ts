// Discord membership verification core — shared by the OAuth callback and the
// manual handoff endpoint. Exchange code -> identify -> membership (+ optional
// role gate) -> uid. Gate rule (default): joined the server AND passed its
// member verification (not pending). Strict mode: if DISCORD_ROLE_ID or
// DISCORD_BOT_TOKEN is set, the member must also hold the configured role.
// The /users/@me/guilds/{id}/member endpoint needs the app's bot installed in
// the server — without one we fall back to the guilds list, which needs no bot.
import { mintToken } from "./xrauth";

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

export type VerifyResult = { ok: true; uid: string } | { ok: false; error: string };

// exchange + identify + membership in one shot; error codes feed the lock screen
export async function exchangeAndVerify(code: string, redirectUri: string): Promise<VerifyResult> {
  if (!SECRET) return { ok: false, error: "setup" };
  try {
    const tokRes = await fetch("https://discord.com/api/v10/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: CID,
        client_secret: SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!tokRes.ok) return { ok: false, error: "setup" };
    const tok = (await tokRes.json()) as { access_token?: string };
    if (!tok.access_token) return { ok: false, error: "setup" };
    const H = { Authorization: "Bearer " + tok.access_token };

    const meRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: H, signal: AbortSignal.timeout(15000),
    });
    if (!meRes.ok) return { ok: false, error: "setup" };
    const me = (await meRes.json()) as { id?: string };
    if (!me.id) return { ok: false, error: "setup" };

    // best path: member object — gives pending (screening) + roles
    const memRes = await fetch(`https://discord.com/api/v10/users/@me/guilds/${GID}/member`, {
      headers: H, signal: AbortSignal.timeout(15000),
    });
    if (memRes.ok) {
      const mem = (await memRes.json()) as { pending?: boolean; roles?: string[] };
      if (mem.pending) return { ok: false, error: "pending" };
      const rerr = await roleGate(Array.isArray(mem.roles) ? mem.roles : []);
      if (rerr) return { ok: false, error: rerr };
      return { ok: true, uid: me.id };
    }
    if (memRes.status === 404) return { ok: false, error: "join" };

    // no bot in the server (403 etc.) — fall back to the plain guilds list
    const gRes = await fetch("https://discord.com/api/v10/users/@me/guilds", {
      headers: H, signal: AbortSignal.timeout(15000),
    });
    if (!gRes.ok) return { ok: false, error: "join" };
    const guilds = (await gRes.json()) as { id?: string }[];
    const inGuild = (Array.isArray(guilds) ? guilds : []).some(g => g && g.id === GID);
    if (!inGuild) return { ok: false, error: "join" };
    const rerr = await roleGate([]); // roles unknown without the member object
    if (rerr) return { ok: false, error: rerr };
    return { ok: true, uid: me.id };
  } catch {
    return { ok: false, error: "setup" };
  }
}

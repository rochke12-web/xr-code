// Discord membership verification core — shared by the OAuth callback and the
// manual handoff endpoint. Exchange code -> identify -> membership + role gate
// -> uid. Owner policy (hard rule): the visitor must have joined the server
// AND currently hold the XR-Auth role. No role check -> no access, even if
// membership itself could be proven (fail closed, handoff invariant 1).
// The member record needs the guilds.members.read scope; resolving the
// XR-Auth role id by name needs a bot token — OR the owner pins DISCORD_ROLE_ID
// directly (no bot required, works with the user-token member record).
import { mintToken } from "./xrauth";
import { XR_SECRETS } from "./xrsecrets";

const CID = process.env.DISCORD_CLIENT_ID || "1569300109790023772";
const GID = process.env.DISCORD_GUILD_ID || "1568895668368711692";
const SECRET = process.env.DISCORD_CLIENT_SECRET || XR_SECRETS.DISCORD_CLIENT_SECRET || "";
const BOT = process.env.DISCORD_BOT_TOKEN || "";
const ROLE_ID = process.env.DISCORD_ROLE_ID || "";
const ROLE_NAME = (process.env.DISCORD_ROLE_NAME || "XR-Auth").trim().toLowerCase();

// 10-minute cache for the bot-token role-name -> id lookup
let roleCache: { id: string; at: number } | null = null;

// owner policy: role gate is ALWAYS on. Resolve the target role id by:
// 1. DISCORD_ROLE_ID env (pin it, no bot needed) — preferred
// 2. bot token + role name lookup (cached 10 min)
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

// policy: joined AND holds the XR-Auth role. No resolvable target or no role
// match -> closed. Never grant on config gaps (fail closed).
async function roleGate(roles: string[]): Promise<string | null> {
  const target = await targetRoleId();
  if (!target) return "roleconf";
  return roles.includes(target) ? null : "role";
}

// The `guilds` scope lets the user token list its own guilds with the owner
// flag. The server owner is the person who manages roles — they pass the gate
// even before the XR-Auth role id is pinned (members do NOT get this pass;
// for them the gate stays fail-closed until the role id is set).
async function isGuildOwner(H: Record<string, string>): Promise<boolean> {
  try {
    const r = await fetch("https://discord.com/api/v10/users/@me/guilds", {
      headers: H, signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return false;
    const gs = (await r.json()) as { id?: string; owner?: boolean }[];
    return Array.isArray(gs) && gs.some(g => g && g.id === GID && g.owner === true);
  } catch {
    return false;
  }
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

    // best path: member object — gives pending (screening) + roles.
    // guilds.members.read scope lets the USER token read its own member
    // record, so roles arrive here even with no bot in the server.
    const memRes = await fetch(`https://discord.com/api/v10/users/@me/guilds/${GID}/member`, {
      headers: H, signal: AbortSignal.timeout(15000),
    });
    if (memRes.ok) {
      const mem = (await memRes.json()) as { pending?: boolean; roles?: string[] };
      if (mem.pending) return { ok: false, error: "pending" };
      const rerr = await roleGate(Array.isArray(mem.roles) ? mem.roles : []);
      if (!rerr) return { ok: true, uid: me.id };
      // role gate failed: the OWNER still passes (they manage the roles);
      // every other member stays closed with the gate error.
      if (await isGuildOwner(H)) return { ok: true, uid: me.id };
      return { ok: false, error: rerr };
    }
    if (memRes.status === 404) return { ok: false, error: "join" };

    // member record unreadable (403 etc.) — roles cannot be proven here, and
    // the policy demands the XR-Auth role. Fallback can only prove membership,
    // which is NOT enough: fail closed with roleconf (owner must fix config).
    return { ok: false, error: "roleconf" };
  } catch {
    return { ok: false, error: "setup" };
  }
}

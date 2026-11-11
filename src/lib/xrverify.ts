// Discord membership verification core — shared by the OAuth callback and the
// manual handoff endpoint. Exchange code -> identify -> membership + role gate
// -> uid. Owner policy (hard rule): the visitor must have joined the server
// AND currently hold the XR-Auth role. No role check -> no access, even if
// membership itself could be proven (fail closed, handoff invariant 1).
// The member record needs the guilds.members.read scope; resolving the
// XR-Auth role id by name needs a bot token — OR the owner pins the role id
// directly (DISCORD_ROLE_ID env, or the in-app owner link in Settings →
// Discord, persisted in the DB / process memory). User tokens can NEVER read
// the guild's role list — that endpoint is bot-only — so the role id must be
// pinned by the owner one way or another.
import { mintToken } from "./xrauth";
import { XR_SECRETS } from "./xrsecrets";
import { db } from "./db";

const CID = process.env.DISCORD_CLIENT_ID || "1569300109790023772";
const GID = process.env.DISCORD_GUILD_ID || "1568895668368711692";
const SECRET = process.env.DISCORD_CLIENT_SECRET || XR_SECRETS.DISCORD_CLIENT_SECRET || "";
const BOT = process.env.DISCORD_BOT_TOKEN || "";
const ROLE_ID = process.env.DISCORD_ROLE_ID || XR_SECRETS.DISCORD_ROLE_ID || "";
const ROLE_NAME = (process.env.DISCORD_ROLE_NAME || "XR-Auth").trim().toLowerCase();
const ROLE_KEY = "xr_auth_role_id";

// 10-minute cache for the resolved role id (DB pin or bot-token lookup)
let roleCache: { id: string; at: number } | null = null;
// DB-unavailable fallback: pin lives in process memory until restart
let memPin = "";

// owner marks: uids that PROVED guild ownership at verify time. The in-app
// role link (/api/discord/pinrole) is only accepted for these, within the
// TTL. In-memory by design — ownership is re-proven on every fresh verify,
// so a restart merely asks the owner to tap Verify once more.
const OWNER_TTL = 30 * 60_000;
const ownerMarks = new Map<string, number>();

export function markOwner(uid: string) {
  ownerMarks.set(uid, Date.now());
  if (ownerMarks.size > 500) {
    const now = Date.now();
    for (const [k, t] of ownerMarks) if (now - t > OWNER_TTL) ownerMarks.delete(k);
  }
}

export function isRecentOwner(uid: string): boolean {
  const t = ownerMarks.get(uid);
  return !!t && Date.now() - t < OWNER_TTL;
}

// Discord snowflakes: 17-20 digits today; accept a slightly wider band so
// future ids still validate, while garbage / other guild's junk does not.
const SNOWFLAKE_RE = /^\d{15,25}$/;

// owner self-service linking (Settings → Discord → Link role): the caller
// must be a verified member who proved guild ownership within OWNER_TTL.
// The role id is pasted by the owner (Discord → Server Settings → Roles →
// right-click XR-Auth → Copy Role ID) — user tokens cannot enumerate roles,
// so this paste replaces the old (impossible) user-token auto-link.
export async function pinRoleByOwner(uid: string, roleId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isRecentOwner(uid)) return { ok: false, error: "owner" };
  const id = String(roleId || "").trim();
  if (!SNOWFLAKE_RE.test(id)) return { ok: false, error: "format" };
  memPin = id;
  roleCache = { id, at: Date.now() };
  try {
    await db.discordConfig.upsert({
      where: { key: ROLE_KEY },
      update: { value: id },
      create: { key: ROLE_KEY, value: id },
    });
  } catch { /* db unavailable — the memory pin keeps this boot working */ }
  return { ok: true };
}

// owner policy: role gate is ALWAYS on. Resolve the target role id by:
// 1. DISCORD_ROLE_ID env (pin it, no bot needed) — preferred
// 2. the DB pin, linked by the server owner in Settings (survives restarts)
// 3. process-memory pin (DB unavailable fallback)
// 4. bot token + role name lookup (cached 10 min)
async function targetRoleId(): Promise<string> {
  if (ROLE_ID) return ROLE_ID;
  if (memPin) return memPin;
  if (roleCache && Date.now() - roleCache.at < 600_000) return roleCache.id;
  try {
    const row = await db.discordConfig.findUnique({ where: { key: ROLE_KEY } });
    if (row && row.value) {
      memPin = row.value;
      roleCache = { id: row.value, at: Date.now() };
      return row.value;
    }
  } catch { /* db unavailable — fall through */ }
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
  if (hit?.id) {
    memPin = hit.id;
    roleCache = { id: hit.id, at: Date.now() };
  }
  return hit?.id || "";
}

// policy: joined AND holds the XR-Auth role. No resolvable target or no role
// match -> closed. Never grant on config gaps (fail closed).
async function roleGate(roles: string[]): Promise<string | null> {
  const target = await targetRoleId();
  if (!target) return "roleconf";
  return roles.includes(target) ? null : "role";
}

export async function pinnedRoleId(): Promise<string> {
  return targetRoleId();
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
      const owner = await isGuildOwner(H);
      if (owner) markOwner(me.id); // unlocks the in-app role link for 30 min
      const rerr = await roleGate(Array.isArray(mem.roles) ? mem.roles : []);
      if (!rerr) return { ok: true, uid: me.id };
      if (owner) {
        // the owner manages the roles — they pass while the role id is
        // unpinned, and Settings → Discord now offers them the one-tap
        // Role-ID link so members can pass the gate too
        return { ok: true, uid: me.id };
      }
      // role gate failed and the visitor is not the owner: closed, with the
      // gate error (members wait for the owner's one-time link)
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

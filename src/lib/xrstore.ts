// XR-Code per-account stores — server-side only.
// Cloud chats + daily token usage, keyed by the verified Google account id (the
// Firebase uid inside the signed __Host-xr_google session cookie). Files live in
// the stable db/ dir — same
// policy as asset-dir.ts: hosted standalone cwd is .next/standalone → ../../db;
// local dev cwd is the project root → ./db; XR_DATA_DIR always wins.
import fs from "fs";
import path from "path";

export const DAILY_TOKEN_LIMIT = 10_000_000; // user directive: 10M tokens/day per account

function baseDir(): string {
  if (process.env.XR_DATA_DIR) return process.env.XR_DATA_DIR;
  // The standalone server chdirs into .next/standalone at boot — data must
  // live OUTSIDE .next (rebuilds regenerate that tree) → project-root db/.
  const cwd = process.cwd();
  if (cwd.includes(`${path.sep}.next`)) {
    const up = path.resolve(cwd, "../../db");
    if (fs.existsSync(path.dirname(up))) return up;
  }
  const root = path.resolve(cwd, "db");
  if (fs.existsSync(root)) return root;
  return path.resolve(cwd, "../../db");
}

export function subdir(name: string): string {
  const dir = path.join(baseDir(), name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// uid is strictly whitelisted — nothing else can ever become
// a file name here (no path traversal, no junk files).
function safeUid(uid: string): string | null {
  return /^[A-Za-z0-9_-]{1,128}$/.test(uid) ? uid : null;
}

// rough token estimate when an engine reply carries no usage block (~4 chars/token)
export function estTokens(s: string): number {
  return Math.ceil((s || "").length / 4);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10); // UTC day — the bucket resets at 00:00 UTC
}

export type Usage = { day: string; tokens: number; updated: number };

function usagePath(uid: string): string | null {
  const id = safeUid(uid);
  return id ? path.join(subdir("usage"), id + ".json") : null;
}

export function getUsage(uid: string): Usage {
  const p = usagePath(uid);
  const t = today();
  if (!p) return { day: t, tokens: 0, updated: 0 };
  try {
    const u = JSON.parse(fs.readFileSync(p, "utf8")) as Usage;
    if (u && u.day === t && typeof u.tokens === "number" && u.tokens >= 0)
      return { day: t, tokens: Math.floor(u.tokens), updated: u.updated || 0 };
  } catch {
    /* first use / corrupt file — fresh bucket */
  }
  return { day: t, tokens: 0, updated: 0 };
}

// best-effort accounting — a failed write must never break a chat reply
export function addUsage(uid: string, n: number): Usage {
  const cur = getUsage(uid);
  if (!(n > 0)) return cur;
  const next: Usage = { day: cur.day, tokens: cur.tokens + Math.floor(n), updated: Date.now() };
  const p = usagePath(uid);
  if (p) {
    try {
      const tmp = p + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(next));
      fs.renameSync(tmp, p);
    } catch {
      /* skip — next request recounts from the last good file */
    }
  }
  return next;
}

export function overLimit(uid: string): { over: boolean; used: number; day: string } {
  const u = getUsage(uid);
  return { over: u.tokens >= DAILY_TOKEN_LIMIT, used: u.tokens, day: u.day };
}

/* ---------- cloud chat store ---------- */

const CHAT_CAPS = {
  chats: 200,        // chats per account
  messages: 400,     // messages per chat (oldest trimmed)
  parts: 16,         // attachment entries per message
  str: 20_000,       // any normal string field
  preview: 130_000,  // 'd' — small attachment preview data URLs
  bytes: 4_000_000,  // total file size
};

// deep size cap for one stored message: strings trimmed, arrays trimmed, plain
// objects walked. 'd' keys (image previews) get the bigger budget — the client
// already caps them at ~110 KB, this just guarantees the bound server-side.
function capValue(v: unknown, key: string): unknown {
  const max = key === "d" ? CHAT_CAPS.preview : CHAT_CAPS.str;
  if (typeof v === "string") return v.slice(0, max);
  if (Array.isArray(v)) return v.slice(0, CHAT_CAPS.parts).map(x => capValue(x, key));
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) o[k] = capValue(val, k);
    return o;
  }
  return v;
}

function sanitizeChats(input: unknown): unknown[] {
  const list = Array.isArray(input) ? input.slice(0, CHAT_CAPS.chats) : [];
  const out: unknown[] = [];
  for (const c of list) {
    if (!c || typeof c !== "object") continue;
    const chat = { ...(c as Record<string, unknown>) };
    chat.id = typeof chat.id === "string" && chat.id.length <= 64 ? chat.id : String(Date.now()) + Math.floor(Math.random() * 1e6);
    chat.title = typeof chat.title === "string" ? chat.title.slice(0, 120) : "New chat";
    chat.ts = typeof chat.ts === "number" && chat.ts > 0 ? Math.floor(chat.ts) : Date.now();
    const msgs = Array.isArray(chat.messages) ? chat.messages.slice(-CHAT_CAPS.messages) : [];
    chat.messages = msgs
      .filter(m => m && typeof m === "object")
      .map(m => {
        const msg: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(m as Record<string, unknown>)) msg[k] = capValue(v, k);
        return msg;
      });
    out.push(chat);
  }
  return out;
}

function chatsPath(uid: string): string | null {
  const id = safeUid(uid);
  return id ? path.join(subdir("chats"), id + ".json") : null;
}

export function readChats(uid: string): unknown[] {
  const p = chatsPath(uid);
  if (!p) return [];
  try {
    const d = JSON.parse(fs.readFileSync(p, "utf8")) as { chats?: unknown };
    return Array.isArray(d?.chats) ? d.chats : [];
  } catch {
    return [];
  }
}

export function writeChats(uid: string, chats: unknown): { ok: boolean; savedAt?: number; error?: string } {
  const p = chatsPath(uid);
  if (!p) return { ok: false, error: "bad uid" };
  const clean = sanitizeChats(chats);
  const body = JSON.stringify({ chats: clean, savedAt: Date.now() });
  if (body.length > CHAT_CAPS.bytes) return { ok: false, error: "too big" };
  try {
    const tmp = p + ".tmp";
    fs.writeFileSync(tmp, body);
    fs.renameSync(tmp, p);
    return { ok: true, savedAt: Date.now() };
  } catch {
    return { ok: false, error: "write" };
  }
}

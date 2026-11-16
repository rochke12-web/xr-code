// BYOK vault — "bring your own key". Users store an OpenAI-compatible API key
// (OpenAI / OpenRouter / Groq / DeepSeek / custom) for their Discord account;
// the chat tries THEIR key first, the hosted brain stays as the backup lane.
// Keys are encrypted at rest (AES-256-GCM, key derived from XR_AUTH_SECRET)
// and never returned to the browser — only a masked hint.
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { XR_SECRETS } from "./xrsecrets";
import { subdir } from "./xrstore";

export type ByokEntry = { enc: string; hint: string; baseUrl?: string; model?: string; at: number };
type Vault = { keys: Record<string, ByokEntry> };

const AAD = "xr-byok-v1";
function cipherKey(): Buffer {
  return crypto.createHash("sha256").update(XR_SECRETS.XR_AUTH_SECRET + ":byok").digest();
}
function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", cipherKey(), iv);
  const out = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return iv.toString("base64") + "." + c.getAuthTag().toString("base64") + "." + out.toString("base64");
}
function decrypt(enc: string): string {
  const [iv, tag, data] = enc.split(".");
  const d = crypto.createDecipheriv("aes-256-gcm", cipherKey(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}
export function maskKey(key: string): string {
  const t = key.trim();
  return t.length <= 10 ? t.slice(0, 2) + "…" : t.slice(0, 6) + "…" + t.slice(-4);
}

// provider → OpenAI-compatible base URL (+ default model when the user omits one)
export const PROVIDERS: Record<string, { base: string; model: string; label: string }> = {
  openai: { base: "https://api.openai.com/v1", model: "gpt-4o-mini", label: "OpenAI" },
  openrouter: { base: "https://openrouter.ai/api/v1", model: "openai/gpt-4o-mini", label: "OpenRouter" },
  groq: { base: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", label: "Groq" },
  deepseek: { base: "https://api.deepseek.com/v1", model: "deepseek-chat", label: "DeepSeek" },
  custom: { base: "", model: "", label: "Custom" },
};

function vaultPath(uid: string): string | null {
  if (!/^\d{5,25}$/.test(uid)) return null; // Discord snowflake only — no traversal
  return path.join(subdir("keys"), uid + ".json");
}

function readVault(uid: string): Vault {
  const p = vaultPath(uid);
  if (!p) return { keys: {} };
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as Vault;
  } catch {
    return { keys: {} };
  }
}
function writeVault(uid: string, v: Vault): boolean {
  const p = vaultPath(uid);
  if (!p) return false;
  fs.writeFileSync(p, JSON.stringify(v, null, 1));
  return true;
}

// POST /api/keys { provider, key, model?, baseUrl? } → save/replace (encrypted)
export function putKey(uid: string, provider: string, key: string, model?: string, baseUrl?: string): { ok: boolean; error?: string } {
  if (!PROVIDERS[provider]) return { ok: false, error: "unknown provider" };
  const k = key.trim();
  if (k.length < 8 || k.length > 400) return { ok: false, error: "key looks invalid" };
  let base = PROVIDERS[provider].base;
  if (provider === "custom") {
    base = (baseUrl || "").trim().replace(/\/+$/, "");
    if (!/^https:\/\/[A-Za-z0-9.-]+([/:A-Za-z0-9._-]*)?$/.test(base)) return { ok: false, error: "custom provider needs a valid https base URL" };
  }
  const v = readVault(uid);
  v.keys[provider] = { enc: encrypt(k), hint: maskKey(k), baseUrl: base || undefined, model: (model || "").trim() || undefined, at: Date.now() };
  return writeVault(uid, v) ? { ok: true } : { ok: false, error: "could not store key" };
}

// DELETE /api/keys { provider } → remove
export function delKey(uid: string, provider: string): boolean {
  const v = readVault(uid);
  if (!v.keys[provider]) return true;
  delete v.keys[provider];
  return writeVault(uid, v);
}

// GET /api/keys → masked listing (never the raw key)
export function listKeys(uid: string): { provider: string; hint: string; model?: string; at: number }[] {
  const v = readVault(uid);
  return Object.entries(v.keys).map(([provider, e]) => ({ provider, hint: e.hint, model: e.model, at: e.at }));
}

// the chat lane: the user's own key, resolved to a transport config
export type ByokLane = { provider: string; key: string; baseUrl: string; model: string };
export function loadByok(uid: string): ByokLane | null {
  const v = readVault(uid);
  const providers = Object.keys(v.keys);
  for (const p of providers) {
    const e = v.keys[p];
    try {
      const key = decrypt(e.enc);
      const base = e.baseUrl || PROVIDERS[p]?.base;
      const model = e.model || PROVIDERS[p]?.model || "";
      if (key && base && model) return { provider: p, key, baseUrl: base, model };
    } catch {
      /* corrupted entry — skip */
    }
  }
  return null;
}

// one OpenAI-compatible chat call on the user's key; null on any failure —
// the hosted chain takes over and the chat never goes dark
export async function byokChat(lane: ByokLane, sys: string, messages: { role: string; content: string }[], timeoutMs = 45000): Promise<string | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetch(lane.baseUrl.replace(/\/+$/, "") + "/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + lane.key },
      signal: ctl.signal,
      body: JSON.stringify({
        model: lane.model,
        messages: [{ role: "system", content: sys }, ...messages],
      }),
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = (j?.choices?.[0]?.message?.content || "").trim();
    return text.length > 1 ? text : null;
  } catch {
    return null;
  }
}

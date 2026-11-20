// BYOK vault — "bring your own key". Users store an OpenAI-compatible API key
// (OpenAI / OpenRouter / Groq / DeepSeek / custom) for their Google account;
// the chat tries THEIR key first, the hosted brain stays as the backup lane.
// Storage is FIRESTORE (xrByokKeys/{uid}) — Vercel's filesystem is ephemeral,
// so the old file vault would have silently emptied on every deploy. Keys are
// encrypted at rest (AES-256-GCM, key derived from XR_AUTH_SECRET), never
// returned to the browser — only a masked hint — and never logged.
import { firebaseDb } from "./firebase-server";
import { XR_SECRETS } from "./xrsecrets";
import { encryptSecret, decryptSecret, maskKey } from "./byok-cipher.mjs";

export type ByokEntry = { enc: string; hint: string; baseUrl?: string; model?: string; at: number };
type Vault = { keys: Record<string, ByokEntry>; active?: string };
export type ByokLane = { provider: string; key: string; baseUrl: string; model: string };

const UID_RE = /^[A-Za-z0-9_-]{1,128}$/; // Firebase uid — no traversal

function vaultSecret(): string {
  return process.env.XR_AUTH_SECRET || XR_SECRETS.XR_AUTH_SECRET;
}

function vaultRef(uid: string) {
  if (!UID_RE.test(uid)) return null;
  return firebaseDb().collection("xrByokKeys").doc(uid);
}

async function readVault(uid: string): Promise<Vault> {
  const ref = vaultRef(uid);
  if (!ref) return { keys: {} };
  const snap = await ref.get();
  const data = snap.data() as { keys?: Record<string, ByokEntry>; active?: string } | undefined;
  return { keys: data?.keys || {}, active: data?.active };
}

async function writeVault(uid: string, v: Vault): Promise<void> {
  const ref = vaultRef(uid);
  if (!ref) throw new Error("bad uid");
  await ref.set({ keys: v.keys, active: v.active || null, updatedAt: Date.now() });
}

// provider → OpenAI-compatible base URL (+ default model when the user omits one)
export const PROVIDERS: Record<string, { base: string; model: string; label: string }> = {
  openai: { base: "https://api.openai.com/v1", model: "gpt-4o-mini", label: "OpenAI" },
  openrouter: { base: "https://openrouter.ai/api/v1", model: "openai/gpt-4o-mini", label: "OpenRouter" },
  groq: { base: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", label: "Groq" },
  deepseek: { base: "https://api.deepseek.com/v1", model: "deepseek-chat", label: "DeepSeek" },
  custom: { base: "", model: "", label: "Custom" },
};

// POST /api/keys { provider, key, model?, baseUrl? } → save/replace (encrypted)
export async function putKey(uid: string, provider: string, key: string, model?: string, baseUrl?: string): Promise<{ ok: boolean; error?: string }> {
  if (!PROVIDERS[provider]) return { ok: false, error: "unknown provider" };
  const k = key.trim();
  if (k.length < 8 || k.length > 400) return { ok: false, error: "key looks invalid" };
  let base = PROVIDERS[provider].base;
  if (provider === "custom") {
    base = (baseUrl || "").trim().replace(/\/+$/, "");
    if (!/^https:\/\/[A-Za-z0-9.-]+([/:A-Za-z0-9._-]*)?$/.test(base)) return { ok: false, error: "custom provider needs a valid https base URL" };
  }
  const v = await readVault(uid);
  v.keys[provider] = { enc: encryptSecret(k, vaultSecret()), hint: maskKey(k), baseUrl: base || undefined, model: (model || "").trim() || undefined, at: Date.now() };
  v.active = provider; // last saved key becomes the lane the chat rides
  await writeVault(uid, v);
  return { ok: true };
}

// DELETE /api/keys { provider } → remove
export async function delKey(uid: string, provider: string): Promise<boolean> {
  const v = await readVault(uid);
  if (!v.keys[provider]) return true;
  delete v.keys[provider];
  if (v.active === provider) v.active = Object.keys(v.keys)[0];
  await writeVault(uid, v);
  return true;
}

// GET /api/keys → masked listing (never the raw key)
export async function listKeys(uid: string): Promise<{ provider: string; hint: string; model?: string; at: number; active?: boolean }[]> {
  const v = await readVault(uid);
  return Object.entries(v.keys).map(([provider, e]) => ({ provider, hint: e.hint, model: e.model, at: e.at, active: v.active === provider }));
}

// the chat lane: the user's own key, resolved to a transport config.
// The ACTIVE provider rides; without one, the first saved provider does.
export async function loadByok(uid: string): Promise<ByokLane | null> {
  const v = await readVault(uid);
  const order = v.active && v.keys[v.active] ? [v.active, ...Object.keys(v.keys).filter(p => p !== v.active)] : Object.keys(v.keys);
  for (const p of order) {
    const e = v.keys[p];
    try {
      const key = decryptSecret(e.enc, vaultSecret());
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
// the hosted chain takes over and the chat never goes dark. The raw key is
// used only inside this request scope: never logged, never echoed back.
export async function byokChat(lane: ByokLane, sys: string, messages: { role: string; content: string }[], timeoutMs = 25000): Promise<string | null> {
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

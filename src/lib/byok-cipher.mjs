// BYOK cipher — pure AES-256-GCM helpers for the key vault. No server-only
// imports here so the unit tests can exercise the real crypto directly.
// Format: iv.b64 . authTag.b64 . ciphertext.b64 (AAD binds the version tag).
import crypto from "node:crypto";

const AAD = "xr-byok-v1";

export function cipherKeyFrom(secret) {
  return crypto.createHash("sha256").update(String(secret) + ":byok").digest();
}

export function encryptSecret(plain, secret) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", cipherKeyFrom(secret), iv);
  c.setAAD(Buffer.from(AAD));
  const out = Buffer.concat([c.update(String(plain), "utf8"), c.final()]);
  return iv.toString("base64") + "." + c.getAuthTag().toString("base64") + "." + out.toString("base64");
}

export function decryptSecret(enc, secret) {
  const [iv, tag, data] = String(enc).split(".");
  if (!iv || !tag || !data) throw new Error("malformed ciphertext");
  const d = crypto.createDecipheriv("aes-256-gcm", cipherKeyFrom(secret), Buffer.from(iv, "base64"));
  d.setAAD(Buffer.from(AAD));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}

export function maskKey(key) {
  const t = String(key).trim();
  return t.length <= 10 ? t.slice(0, 2) + "…" : t.slice(0, 6) + "…" + t.slice(-4);
}

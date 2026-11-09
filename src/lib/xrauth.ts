// XR-Code Discord gate — shared signing helpers (server-side only).
// A verified member gets a short signed token in an HttpOnly cookie;
// every AI call must carry it. No cookie / bad signature / kicked ->
// the AI refuses to answer.
import { createHmac, timingSafeEqual } from "crypto";

export const AUTH_COOKIE = "xr_ds";
const DAY = 24 * 60 * 60;
export const MAX_AGE = 30 * DAY; // re-verify once a month -> live membership stays truthful

function secret(): string {
  return process.env.XR_AUTH_SECRET || process.env.DISCORD_CLIENT_SECRET || "xr-dev-secret-change-me";
}

export function sign(uid: string, iat: number): string {
  return createHmac("sha256", secret()).update(uid + "." + iat).digest("hex").slice(0, 40);
}

export function mintToken(uid: string): string {
  const iat = Math.floor(Date.now() / 1000);
  return `v1.${uid}.${iat}.${sign(uid, iat)}`;
}

export type Ver = { ok: boolean; uid?: string; error?: string };

export function verifyToken(t: string | undefined | null): Ver {
  if (!t) return { ok: false, error: "none" };
  const p = t.split(".");
  if (p.length !== 4 || p[0] !== "v1") return { ok: false, error: "bad" };
  const uid = p[1];
  const iat = parseInt(p[2], 10);
  const sig = p[3];
  if (!uid || !iat || !sig) return { ok: false, error: "bad" };
  const got = Buffer.from(sig);
  const want = Buffer.from(sign(uid, iat));
  if (got.length !== want.length || !timingSafeEqual(got, want)) return { ok: false, error: "bad" };
  if (Math.floor(Date.now() / 1000) - iat > MAX_AGE) return { ok: false, error: "expired" };
  return { ok: true, uid };
}

export function cookieToken(req: Request): string | null {
  const raw = req.headers.get("cookie") || "";
  for (const part of raw.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === AUTH_COOKIE) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}

export function verifyDiscord(req: Request): Ver {
  return verifyToken(cookieToken(req));
}

export function authCookie(token: string): string {
  return `${AUTH_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax; HttpOnly`;
}

export function clearAuthCookie(): string {
  return `${AUTH_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

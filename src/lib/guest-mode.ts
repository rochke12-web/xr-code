import 'server-only';
import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';

/* ---------- XR-Code guest mode (maximum-limitation tier) ----------
 * Visitors without a Google session get a device-keyed (HWID) identity and
 * the tightest quotas in the app:
 *   · 50 chat messages / UTC day per device
 *   · 1 image / UTC day per device (enforced in the imagine route)
 *   · video mode stays members-only
 * Identity = client-supplied hardware fingerprint header (x-xr-hwid) when
 * sane, else the IP+UA hash (same fallback the imagine route already used).
 * Quota lives in FIRESTORE (xrGuestQuota/{gid}) — same reason the media
 * buckets live there: Vercel's filesystem is ephemeral. Never trust a
 * client-sent count; the transaction here is the only source of truth.
 */

export const GUEST_TEXT_LIMIT = 50; // user directive: 50 text messages/day per HWID
export const GUEST_IMAGE_LIMIT = 1; // user directive: 1 photo/day per HWID

const HWID_RE = /^[A-Za-z0-9_-]{8,64}$/;

export type GuestIdentity = { gid: string; how: 'hwid' | 'fingerprint' };

// stable per-device id for this request: HWID header when it looks sane,
// otherwise a hash of the forwarded IP + user agent (best effort — guests
// behind rotating proxies share a bucket, which errs on the strict side)
export function guestIdentity(req: Request): GuestIdentity {
  const raw = (req.headers.get('x-xr-hwid') || '').trim();
  if (HWID_RE.test(raw) && !raw.includes('/') && raw.length <= 64) {
    return { gid: `hw:${raw}`, how: 'hwid' };
  }
  const fwd = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  const fp = createHash('sha256')
    .update(`${fwd}|${req.headers.get('user-agent') || ''}|xr-guest-fp`)
    .digest('hex')
    .slice(0, 14);
  return { gid: `fp:${fp}`, how: 'fingerprint' };
}

// pure decision — same shape as daily-message-policy.evaluateDailyMessage so
// the guest bucket behaves exactly like the members bucket (UTC day rollover)
export function evaluateGuestMessage({ now, usedDay, usedCount }: { now: Date; usedDay?: string; usedCount?: number }) {
  if (!(now instanceof Date) || Number.isNaN(now.valueOf())) throw new TypeError('Invalid date');
  const day = now.toISOString().slice(0, 10);
  const count = usedDay === day ? Math.max(0, Math.floor(usedCount) || 0) : 0;
  if (count >= GUEST_TEXT_LIMIT) return { allowed: false, reason: 'guest_daily_limit' as const, day, count, limit: GUEST_TEXT_LIMIT };
  return { allowed: true, day, count: count + 1, limit: GUEST_TEXT_LIMIT };
}

// atomically reserve one guest message. db = authenticated Firebase Admin
// Firestore. Errors propagate so the API can fail closed like the members path.
export async function reserveGuestMessage(db: Firestore, gid: string, now = new Date()) {
  if (typeof gid !== 'string' || !gid || gid.includes('/') || gid.length > 128) throw new TypeError('Invalid guest id');
  const ref = db.collection('xrGuestQuota').doc(gid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};
    const decision = evaluateGuestMessage({ now, usedDay: data.day ?? '', usedCount: data.count ?? 0 });
    if (decision.allowed) {
      tx.set(ref, { day: decision.day, count: decision.count, updated: Date.now() }, { merge: true });
    }
    return decision;
  });
}

import { createHash } from 'node:crypto';

export function policyId(email) {
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 320) throw new TypeError('Invalid email');
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

/**
 * Pure per-account daily message policy. Store and mutate these records inside
 * a Firestore transaction on the server; this module does not enforce quotas
 * on its own. All day boundaries are UTC. Never trust client-provided counts.
 */
export const DEFAULT_DAILY_MESSAGES = 100;
export function evaluateDailyMessage({ now, usedDay, usedCount, dailyLimit, disabled }) {
  if (!(now instanceof Date) || Number.isNaN(now.valueOf())) throw new TypeError('Invalid date');
  if (typeof disabled !== 'boolean') throw new TypeError('Invalid disabled flag');
  if (!Number.isSafeInteger(dailyLimit) || dailyLimit < 0) throw new TypeError('Invalid daily limit');
  if (!Number.isSafeInteger(usedCount) || usedCount < 0) throw new TypeError('Invalid usage');
  const day = now.toISOString().slice(0, 10);
  const count = usedDay === day ? usedCount : 0;
  if (disabled) return { allowed: false, reason: 'disabled', day, count, limit: dailyLimit };
  if (count >= dailyLimit) return { allowed: false, reason: 'daily_limit', day, count, limit: dailyLimit };
  return { allowed: true, day, count: count + 1, limit: dailyLimit };
}

/** Reserve one message atomically. `db` must be an authenticated Firebase Admin
 * Firestore instance, never the browser SDK. The caller must first verify the
 * Firebase ID token and supply its stable uid. Errors intentionally propagate so
 * the calling API can fail closed when Firestore is unavailable.
 */
export async function reserveDailyMessage(db, uid, now = new Date(), email = null) {
  if (typeof uid !== 'string' || !uid || uid.includes('/') || uid.length > 128) throw new TypeError('Invalid user id');
  const userRef = db.collection('xrUsers').doc(uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const data = snap.exists ? snap.data() : {};
    const policySnap = email ? await tx.get(db.collection('xrEmailPolicies').doc(policyId(email))) : null;
    const policy = policySnap?.exists ? policySnap.data() : {};
    const decision = evaluateDailyMessage({
      now,
      usedDay: data.usageDay ?? '',
      usedCount: data.messageCount ?? 0,
      dailyLimit: policy.dailyLimit ?? data.dailyLimit ?? DEFAULT_DAILY_MESSAGES,
      disabled: policy.disabled ?? data.disabled ?? false,
    });
    if (decision.allowed) {
      tx.set(userRef, { usageDay: decision.day, messageCount: decision.count }, { merge: true });
    }
    return decision;
  });
}

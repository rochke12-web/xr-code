// XR-Code admin registry — master access management.
// The MASTER (owner, rochke12@gmail.com) always has access — hardcoded, cannot
// be removed or blocked through the API. Additional admins live in the
// Firestore xrAdmins collection (doc id = sha256(email), same scheme as
// xrEmailPolicies). Every admin API route must verify the session through
// currentAdmin() — never trust a client-side flag.
import 'server-only';
import { firebaseDb, verifiedGoogleSession } from './firebase-server';
import { policyId } from './daily-message-policy.mjs';

export const MASTER_EMAIL = 'rochke12@gmail.com';

export type AdminInfo = { email: string; role: 'master' | 'admin' };

function normEmail(email: unknown): string {
  const e = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 320) throw new TypeError('Invalid email');
  return e;
}

// Who is calling? master always passes (even mid-Firestore-outage); other
// emails need an xrAdmins doc. Disabled accounts never pass (session check).
export async function currentAdmin(req: Request): Promise<AdminInfo | null> {
  const user = await verifiedGoogleSession(req);
  if (!user?.email) return null;
  const email = user.email.toLowerCase();
  if (email === MASTER_EMAIL) return { email, role: 'master' };
  try {
    const snap = await firebaseDb().collection('xrAdmins').doc(policyId(email)).get();
    if (snap.exists && snap.data()?.role === 'admin') return { email, role: 'admin' };
  } catch { /* Firestore down — fail closed for non-master admins */ }
  return null;
}

export async function listAdmins(): Promise<AdminInfo[]> {
  const snap = await firebaseDb().collection('xrAdmins').get();
  const out: AdminInfo[] = [{ email: MASTER_EMAIL, role: 'master' }];
  snap.forEach(d => {
    const v = d.data();
    if (v?.role === 'admin' && typeof v.email === 'string') out.push({ email: v.email.toLowerCase(), role: 'admin' });
  });
  return out;
}

export async function addAdmin(email: unknown, addedBy: string): Promise<void> {
  const e = normEmail(email);
  if (e === MASTER_EMAIL) throw new TypeError('master cannot be re-added');
  await firebaseDb().collection('xrAdmins').doc(policyId(e)).set({
    email: e, role: 'admin', addedAt: Date.now(), addedBy: String(addedBy || '').slice(0, 320),
  });
}

export async function removeAdmin(email: unknown): Promise<void> {
  const e = normEmail(email);
  if (e === MASTER_EMAIL) throw new TypeError('the master account cannot be removed');
  await firebaseDb().collection('xrAdmins').doc(policyId(e)).delete();
}

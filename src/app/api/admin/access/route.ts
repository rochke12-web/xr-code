import { NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/admin';
import { firebaseDb } from '@/lib/firebase-server';
import { policyId } from '@/lib/daily-message-policy.mjs';

// PUT /api/admin/access — one-click block / unblock of a Google account.
// Writes xrEmailPolicies.disabled, which verifiedGoogleSession enforces on
// EVERY API route: a blocked account's session cookie stops working at once.
function originOk(req: Request) {
  const o = req.headers.get('origin') || '';
  return o === 'https://xr-code.vercel.app' || /^https:\/\/xr-code-.*\.vercel\.app$/.test(o) || o.startsWith('http://localhost');
}
export async function PUT(req: Request) {
  if (!originOk(req)) return NextResponse.json({ error: 'origin' }, { status: 403 });
  const a = await currentAdmin(req);
  if (!a) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  try {
    const body = await req.json();
    const email = String(body?.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
    if (typeof body?.disabled !== 'boolean') return NextResponse.json({ error: 'invalid_flag' }, { status: 400 });
    if (email === a.email) return NextResponse.json({ error: 'cannot_block_yourself' }, { status: 400 });
    const ref = firebaseDb().collection('xrEmailPolicies').doc(policyId(email));
    const snap = await ref.get();
    const prev = snap.exists ? snap.data() : {};
    await ref.set({ email, dailyLimit: prev?.dailyLimit ?? 100, disabled: body.disabled }, { merge: true });
    return NextResponse.json({ ok: true, email, blocked: body.disabled });
  } catch (e) {
    return NextResponse.json({ error: 'unavailable: ' + String(e).slice(0, 120) }, { status: 503 });
  }
}

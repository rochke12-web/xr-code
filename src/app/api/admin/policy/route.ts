import { NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/admin';
import { firebaseDb } from '@/lib/firebase-server';
import { policyId } from '@/lib/daily-message-policy.mjs';

// master (hardcoded) + any xrAdmins doc — shared with the other admin routes
async function isAdmin(req: Request) {
  return !!(await currentAdmin(req));
}
export async function GET(req: Request) {
  if (!await isAdmin(req)) return NextResponse.json({error:'forbidden'}, {status:403});
  try {
    const email = new URL(req.url).searchParams.get('email') || '';
    const snap = await firebaseDb().collection('xrEmailPolicies').doc(policyId(email)).get();
    return NextResponse.json({policy: snap.exists ? snap.data() : {dailyLimit:100, disabled:false}}, {headers:{'Cache-Control':'no-store'}});
  } catch { return NextResponse.json({error:'invalid_email_or_unavailable'}, {status:400}); }
}
// any xr-code Vercel deployment origin (production + every preview branch) —
// the hard authorization line stays the session email check below
function originOk(req: Request) {
  const o = req.headers.get('origin') || '';
  return o === 'https://xr-code.vercel.app' || /^https:\/\/xr-code-.*\.vercel\.app$/.test(o);
}
export async function PUT(req: Request) {
  if (!originOk(req)) return NextResponse.json({error:'origin'}, {status:403});
  if (!await isAdmin(req)) return NextResponse.json({error:'forbidden'}, {status:403});
  try {
    const body = await req.json();
    const id = policyId(body.email);
    if (!Number.isSafeInteger(body.dailyLimit) || body.dailyLimit < 0 || body.dailyLimit > 100000 || typeof body.disabled !== 'boolean') return NextResponse.json({error:'invalid_policy'}, {status:400});
    await firebaseDb().collection('xrEmailPolicies').doc(id).set({email:body.email.trim().toLowerCase(), dailyLimit:body.dailyLimit, disabled:body.disabled});
    return NextResponse.json({ok:true});
  } catch { return NextResponse.json({error:'invalid_input_or_unavailable'}, {status:400}); }
}

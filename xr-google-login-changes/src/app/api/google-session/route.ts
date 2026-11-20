import { NextResponse } from 'next/server';
import { firebaseAuth, verifiedGoogleSession } from '@/lib/firebase-server';

const origin = 'https://xr-code.vercel.app';
const maxAge = 5 * 24 * 60 * 60;
function sameOrigin(req: Request) { return req.headers.get('origin') === origin; }
function cookie(value: string, age: number) {
  return `__Host-xr_google=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
}
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'origin' }, { status: 403 });
  try {
    const { idToken } = await req.json();
    if (typeof idToken !== 'string' || idToken.length > 16384) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    const auth = firebaseAuth();
    const claims = await auth.verifyIdToken(idToken, true);
    if (claims.firebase?.sign_in_provider !== 'google.com' || !claims.email_verified || !claims.auth_time || Date.now()/1000 - claims.auth_time > 300) {
      return NextResponse.json({ error: 'fresh_google_signin_required' }, { status: 401 });
    }
    const session = await auth.createSessionCookie(idToken, { expiresIn: maxAge * 1000 });
    const res = NextResponse.json({ ok: true });
    res.headers.append('Set-Cookie', cookie(session, maxAge));
    return res;
  } catch { return NextResponse.json({ error: 'authentication_failed' }, { status: 401 }); }
}
export async function GET(req: Request) {
  const user = await verifiedGoogleSession(req);
  return NextResponse.json({ authenticated: !!user, email: user?.email || null }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: 'origin' }, { status: 403 });
  const res = NextResponse.json({ ok: true });
  res.headers.append('Set-Cookie', cookie('', 0));
  return res;
}

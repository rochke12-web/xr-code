import { NextResponse } from 'next/server';
import { currentAdmin, listAdmins, addAdmin, removeAdmin, MASTER_EMAIL } from '@/lib/admin';

function originOk(req: Request) {
  const o = req.headers.get('origin') || '';
  return o === 'https://xr-code.vercel.app' || /^https:\/\/xr-code-.*\.vercel\.app$/.test(o) || o.startsWith('http://localhost');
}

// GET /api/admin/admins — who holds admin access right now.
export async function GET(req: Request) {
  const a = await currentAdmin(req);
  if (!a) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, admins: await listAdmins() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: 'unavailable: ' + String(e).slice(0, 120) }, { status: 503 });
  }
}

// POST /api/admin/admins — grant or revoke admin. The master account is
// immutable: it can never be removed (revoking yourself as a plain admin is
// allowed, so an admin can hand their own access back).
export async function POST(req: Request) {
  if (!originOk(req)) return NextResponse.json({ error: 'origin' }, { status: 403 });
  const a = await currentAdmin(req);
  if (!a) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  try {
    const body = await req.json();
    const email = String(body?.email || '').trim().toLowerCase();
    const action = String(body?.action || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
    if (email === MASTER_EMAIL && action === 'remove')
      return NextResponse.json({ error: 'master_immutable' }, { status: 400 });
    if (action === 'add') { await addAdmin(email, a.email); return NextResponse.json({ ok: true, added: email }); }
    if (action === 'remove') {
      if (email === a.email) return NextResponse.json({ error: 'cannot_remove_yourself' }, { status: 400 });
      await removeAdmin(email);
      return NextResponse.json({ ok: true, removed: email });
    }
    return NextResponse.json({ error: 'bad_action' }, { status: 400 });
  } catch (e) {
    const msg = String((e as Error)?.message || e);
    return NextResponse.json({ error: msg.includes('Invalid email') ? 'invalid_email' : 'unavailable: ' + msg.slice(0, 120) }, { status: 400 });
  }
}

import { NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/admin';
import { firebaseAuth, firebaseDb } from '@/lib/firebase-server';
import { getUsage, hasLocalChats } from '@/lib/xrstore';

// GET /api/admin/users — every Google account that ever signed in, merged with
// its access policy (block flag + daily message limit) and local token usage.
// Read-only snapshot for the master panel; nothing here mutates state.
export async function GET(req: Request) {
  const a = await currentAdmin(req);
  if (!a) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  try {
    const [usersRes, policies] = await Promise.all([
      firebaseAuth().listUsers(1000),
      firebaseDb().collection('xrEmailPolicies').get(),
    ]);
    const pol = new Map<string, { disabled?: boolean; dailyLimit?: number }>();
    policies.forEach(d => {
      const v = d.data();
      if (typeof v?.email === 'string') pol.set(v.email.toLowerCase(), { disabled: v.disabled === true, dailyLimit: v.dailyLimit });
    });
    const users = usersRes.users.map(u => {
      const email = (u.email || '').toLowerCase();
      const p = pol.get(email) || {};
      const usage = getUsage(u.uid);
      return {
        uid: u.uid,
        email,
        blocked: p.disabled === true,
        dailyLimit: p.dailyLimit ?? null,
        lastSignIn: u.metadata?.lastSignInTime || null,
        createdAt: u.metadata?.creationTime || null,
        tokensToday: usage.tokens,
        day: usage.day,
        hasChats: hasLocalChats(u.uid),
      };
    });
    // blocked accounts that never signed in locally still matter — append them
    for (const [email, p] of pol.entries()) {
      if (!users.some(u => u.email === email) && p.disabled) {
        users.push({ uid: '', email, blocked: true, dailyLimit: p.dailyLimit ?? null, lastSignIn: null, createdAt: null, tokensToday: 0, day: '', hasChats: false });
      }
    }
    users.sort((x, y) => String(y.lastSignIn || '').localeCompare(String(x.lastSignIn || '')));
    return NextResponse.json({ ok: true, users }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: 'unavailable: ' + String(e).slice(0, 120) }, { status: 503 });
  }
}

import { NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/admin';
import { readChats } from '@/lib/xrstore';

// GET /api/admin/chats?uid=<firebase uid> — read-only view of a user's cloud
// chats (the same store /api/chats serves to the account itself). Master eyes
// only, and strictly read: no write path exists here, user data is never
// modified or deleted by the panel.
export async function GET(req: Request) {
  const a = await currentAdmin(req);
  if (!a) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const uid = new URL(req.url).searchParams.get('uid') || '';
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid))
    return NextResponse.json({ error: 'bad uid' }, { status: 400 });
  try {
    const chats = readChats(uid) as Array<Record<string, unknown>>;
    // trim for transport: keep id/title/time + the last 40 messages per chat,
    // drop heavy attachment previews (the 'd' data URLs)
    const slim = chats.slice(-40).map(c => ({
      id: c.id, title: c.title, ts: c.ts,
      messages: Array.isArray(c.messages)
        ? (c.messages as Array<Record<string, unknown>>).slice(-40).map(m => {
            const o: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(m || {})) if (k !== 'd' && k !== 'send') o[k] = v;
            return o;
          })
        : [],
    }));
    return NextResponse.json({ ok: true, chats: slim }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: 'unavailable: ' + String(e).slice(0, 120) }, { status: 503 });
  }
}

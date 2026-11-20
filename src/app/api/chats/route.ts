// Per-account cloud chat store — chats follow the Google account.
// GET  → { ok, chats, tokens, limit, day }
// PUT  → body { chats } → { ok, savedAt }
// Fail closed: every call needs the verified Google session cookie.
// The Firebase uid is the storage key — two accounts can never see each
// other's chats, and usage/quota rides the same id.
import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/request-auth";
import { readChats, writeChats, getUsage, DAILY_TOKEN_LIMIT } from "@/lib/xrstore";

export async function GET(req: Request) {
  const v = await verifyRequest(req);
  if (!v.ok || !v.uid)
    return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });
  const u = getUsage(v.uid);
  return NextResponse.json({
    ok: true,
    chats: readChats(v.uid),
    tokens: u.tokens,
    limit: DAILY_TOKEN_LIMIT,
    day: u.day,
  });
}

export async function PUT(req: Request) {
  const v = await verifyRequest(req);
  if (!v.ok || !v.uid)
    return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });
  let body: { chats?: unknown } | null = null;
  try {
    body = await req.json();
  } catch {
    /* bad json — treated as empty */
  }
  const r = writeChats(v.uid, body?.chats);
  if (!r.ok)
    return NextResponse.json({ ok: false, error: r.error || "write" }, { status: 400 });
  return NextResponse.json({ ok: true, savedAt: r.savedAt });
}

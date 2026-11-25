// One poll per call for a video job ticket created by /api/chat (video mode).
// The client drives the cadence (every 6s); each request here stays ≤10s so a
// multi-minute render can never hit Vercel's 60s function kill (which is what
// produced the old "busy · retrying…" loops). Members-only: the ticket rides
// the verified Google session, and the daily video count lands on SUCCESS.
import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/request-auth";
import { pollVideoGen } from "@/lib/videogen";

export async function GET(req: Request) {
  const v = await verifyRequest(req);
  if (!v.ok || !v.uid)
    return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });
  const tid = new URL(req.url).searchParams.get("tid") || "";
  if (!/^[A-Za-z0-9_-]{6,120}$/.test(tid))
    return NextResponse.json({ ok: false, error: "bad ticket" }, { status: 400 });
  const r = await pollVideoGen(tid, v.uid);
  return NextResponse.json({ ok: true, ...r });
}

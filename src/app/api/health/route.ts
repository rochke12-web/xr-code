import { NextResponse } from "next/server";

// lightweight liveness probe — no model call, safe to hit every few seconds
export async function GET() {
  return NextResponse.json({ ok: true, ts: Date.now() });
}

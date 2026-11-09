// Un-verify — clears the gate cookie so the lock comes back.
import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/xrauth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", clearAuthCookie());
  return res;
}

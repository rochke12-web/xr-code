import { NextResponse } from 'next/server';
import { currentAdmin } from '@/lib/admin';

// GET /api/admin/me — is the signed-in account an admin? Drives the Settings
// panel visibility (server-verified; the UI never decides on its own).
export async function GET(req: Request) {
  const a = await currentAdmin(req);
  if (!a) return NextResponse.json({ admin: false }, { headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json({ admin: true, email: a.email, role: a.role }, { headers: { 'Cache-Control': 'no-store' } });
}

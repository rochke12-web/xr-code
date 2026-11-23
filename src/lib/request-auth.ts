import 'server-only';
import { verifiedGoogleSession } from './firebase-server';
export async function verifyRequest(req: Request): Promise<{ok:boolean; uid?:string; email?:string; error?:string}> {
  const user = await verifiedGoogleSession(req);
  return user ? { ok: true, uid: user.uid, email: user.email || undefined } : { ok: false, error: 'none' };
}

import 'server-only';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { policyId } from './daily-message-policy.mjs';

// Set the service account JSON as a sensitive server-only Vercel environment
// variable. Never commit its private key and never send it to the browser.
function firebaseApp() {
  const existing = getApps().find(app => app.name === 'xr-firebase');
  if (existing) return existing;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured');
  const credential = JSON.parse(raw);
  if (credential.project_id !== 'xr-code-b0245') throw new Error('Firebase project mismatch');
  return initializeApp({ credential: cert(credential), projectId: 'xr-code-b0245' }, 'xr-firebase');
}
export function firebaseAuth() { return getAuth(firebaseApp()); }
export function firebaseDb() { return getFirestore(firebaseApp()); }
// true when credentials exist — callers use it to fail-open (skip quota)
// instead of 503-ing every request when only the env var is missing.
export function firebaseConfigured() {
  try { return !!JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || ""); }
  catch { return false; }
}

export async function verifiedGoogleSession(req: Request) {
  const token = (req.headers.get('cookie') || '').split(/;\s*/)
    .find(part => part.startsWith('__Host-xr_google='))?.slice('__Host-xr_google='.length);
  if (!token) return null;
  try {
    const claims = await firebaseAuth().verifySessionCookie(decodeURIComponent(token), true);
    if (claims.firebase?.sign_in_provider !== 'google.com' || !claims.email_verified || !claims.email) return null;
    const policy = await firebaseDb().collection('xrEmailPolicies').doc(policyId(claims.email)).get();
    if (policy.exists && policy.data()?.disabled === true) return null;
    return { uid: claims.uid, email: claims.email }; 
  } catch { return null; }
}

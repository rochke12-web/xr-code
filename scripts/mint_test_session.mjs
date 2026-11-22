// Mint a local test session: admin custom token → Google REST idToken →
// POST /api/google-session → session cookie value printed for playwright.
// Runs OUTSIDE the Next app (imports firebase-admin directly), never prints
// secrets.
import { cert, initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';

// resolve the service credential exactly like src/lib/firebase-server.ts
const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
  (() => { throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not set in this shell'); })();

const cred = JSON.parse(raw);
const app = getApps().find(a => a.name === 'xr-firebase') ||
  initializeApp({ credential: cert(cred), projectId: cred.project_id }, 'xr-firebase');
const uid = 'preview-test-user';
const custom = await getAuth(app).createCustomToken(uid, { name: 'Preview Tester' });

// exchange at Google Identity Toolkit — needs the web apiKey
const gate = readFileSync('src/components/google-signin-gate.tsx', 'utf8');
const apiKey = gate.match(/apiKey:\s*"([^"]+)"/)?.[1];
if (!apiKey) throw new Error('no web apiKey in gate');
const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: custom, returnSecureToken: true }),
});
if (!r.ok) { console.log('exchange failed', r.status, (await r.text()).slice(0, 200)); process.exit(1); }
const { idToken } = await r.json();

// bake the session cookie through the local endpoint
const sr = await fetch('http://localhost:3000/api/google-session', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ idToken }),
});
const setc = sr.headers.get('set-cookie') || '';
if (!setc) { console.log('session failed', sr.status); process.exit(1); }
const sess = setc.split(';')[0];
console.log('SESSION_COOKIE_OK len=' + sess.length);
await import('fs').then(fs => fs.writeFileSync('/tmp/xr-test-cookie.txt', sess));

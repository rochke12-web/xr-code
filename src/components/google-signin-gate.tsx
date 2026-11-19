git status'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { getApps, initializeApp } from 'firebase/app'
import { GoogleAuthProvider, getAuth, signInWithPopup, signOut } from 'firebase/auth'

// Firebase web configuration identifies a public browser app, not an Admin key.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'xr-code-b0245.firebaseapp.com',
  projectId: 'xr-code-b0245',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}
function authClient() {
  if (!config.apiKey || !config.appId) throw new Error('Firebase web configuration is missing')
  const app = getApps().find(a => a.name === 'xr-web') || initializeApp(config, 'xr-web')
  return getAuth(app)
}
export default function GoogleSigninGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'signedOut' | 'ready'>('checking')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [adminOpen, setAdminOpen] = useState(false)
  const [targetEmail, setTargetEmail] = useState('')
  const [limit, setLimit] = useState('100')
  const [disabled, setDisabled] = useState(false)
  const [adminMessage, setAdminMessage] = useState('')
  useEffect(() => {
    let active = true
    fetch('/api/google-session', { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => { if (active) { setEmail(data.email || ''); setStatus(data.authenticated ? 'ready' : 'signedOut') } })
      .catch(() => { if (active) { setError('Unable to check your session. Please try again.'); setStatus('signedOut') } })
    return () => { active = false }
  }, [])
  async function login() {
    setBusy(true); setError('')
    try {
      const auth = authClient()
      const credential = await signInWithPopup(auth, new GoogleAuthProvider())
      const idToken = await credential.user.getIdToken(true)
      const res = await fetch('/api/google-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) })
      if (!res.ok) throw new Error('Could not create a secure session')
      setEmail(credential.user.email || '')
      setStatus('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed. Please try again.')
    } finally { setBusy(false) }
  }
  async function logout() {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/google-session', { method: 'DELETE' })
      if (!res.ok) throw new Error('Could not sign out')
      await signOut(authClient()); setEmail(''); setStatus('signedOut')
    } catch { setError('Could not sign out. Please try again.') }
    finally { setBusy(false) }
  }
  async function policy(save: boolean) {
    setAdminMessage('');
    try {
      const res = await fetch(save ? '/api/admin/policy' : '/api/admin/policy?email=' + encodeURIComponent(targetEmail), save ? {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({email: targetEmail, dailyLimit: Number(limit), disabled})
      } : {cache:'no-store'});
      const data = await res.json();
      if (!res.ok) throw new Error('Could not ' + (save ? 'save' : 'load') + ' policy. Check the email and limit.');
      if (!save) { setLimit(String(data.policy.dailyLimit)); setDisabled(data.policy.disabled); }
      setAdminMessage(save ? 'Policy saved.' : 'Policy loaded.');
    } catch (e) { setAdminMessage(e instanceof Error ? e.message : 'Request failed.'); }
  }
  if (status === 'ready') return <><div style={{ position: 'fixed', top: 8, right: 8, zIndex: 100, background:'#18181b', color:'white', padding:8 }}>
    {email.toLowerCase() === 'rochke12@gmail.com' && <button onClick={() => setAdminOpen(!adminOpen)}>Admin</button>}{' '}
    <button onClick={logout} disabled={busy} aria-label={`Sign out ${email}`}>Sign out</button>
    {adminOpen && <section style={{padding:16, width:280, display:'grid', gap:10}}><strong>Account access</strong>
      <label>Email <input type="email" value={targetEmail} onChange={e=>setTargetEmail(e.target.value)} /></label>
      <button onClick={() => policy(false)}>Load policy</button>
      <label>Daily message limit <input type="number" min="0" max="100000" value={limit} onChange={e=>setLimit(e.target.value)} /></label>
      <label><input type="checkbox" checked={disabled} onChange={e=>setDisabled(e.target.checked)} /> Block account</label>
      <button onClick={() => policy(true)}>Save policy</button><span role="status">{adminMessage}</span>
    </section>}</div>{children}</>
  return <main style={{ minHeight:'100vh', boxSizing:'border-box', display:'grid', placeItems:'center', background:'radial-gradient(ellipse at 50% 42%, #202020 0%, #080808 65%)', color:'#f5f5f5', fontFamily:'system-ui, sans-serif', padding:24 }}>
    <section style={{ width:'min(430px, 92vw)', boxSizing:'border-box', padding:'36px 32px', borderRadius:24, border:'1px solid #383838', background:'#171717', textAlign:'center', boxShadow:'0 30px 90px rgba(0,0,0,.55)' }}>
      <img src="/icon.png" alt="XR-Code" width="58" height="58" style={{ borderRadius:16, objectFit:'cover', marginBottom:16 }} />
      <h1 style={{ margin:'0 0 8px', fontSize:20, fontWeight:700 }}>Welcome to XR-Code</h1>
      <p style={{ margin:'0 0 18px', fontSize:12.5, lineHeight:1.7, color:'#aaa' }}>Sign in with Google to get started.<br />Enjoy up to 100 AI messages per day.</p>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginBottom:18, fontSize:11, color:'#aaa' }}>
        <span style={{ border:'1px solid #333', borderRadius:999, padding:'5px 11px' }}>1 &nbsp; Sign in</span><span>→</span><span style={{ border:'1px solid #333', borderRadius:999, padding:'5px 11px' }}>2 &nbsp; Start creating</span>
      </div>
      {error && <p role="alert" style={{ color:'#fca5a5', fontSize:12 }}>{error}</p>}
      <button type="button" onClick={login} disabled={busy || status === 'checking'} style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', gap:10, border:0, borderRadius:13, padding:'13px 24px', background:'#fff', color:'#171717', fontSize:13.5, fontWeight:700, cursor:'pointer', boxShadow:'0 6px 26px -8px #888' }}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.7h11c-.5 2.5-1.9 4.6-4 6v5h6.6c3.9-3.6 6-8.8 6-14.6z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.6-4.9l-6.6-5c-1.8 1.2-4.2 1.9-7 1.9-5.3 0-9.8-3.6-11.4-8.4H5.8v5.2C9.2 39.5 16.1 44 24 44z"/><path fill="#FBBC05" d="M12.6 27.6a12.1 12.1 0 010-7.2v-5.2H5.8a20 20 0 000 17.6z"/><path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3l5.9-5.9A20 20 0 005.8 15.2l6.8 5.2C14.2 15.6 18.7 12 24 12z"/></svg>
        {status === 'checking' ? 'Checking session…' : busy ? 'Opening Google…' : 'Login with Google'}
      </button><br />
      <a href="https://discord.gg/YPqmsrMRr5" target="_blank" rel="noopener noreferrer" style={{ display:'inline-flex', marginTop:14, padding:'12px 22px', border:'1px solid #383838', borderRadius:13, color:'#f5f5f5', fontSize:12.5, fontWeight:600, textDecoration:'none' }}>Join the Discord server</a>
      <p style={{ margin:'18px 0 0', color:'#888', fontSize:10.5, lineHeight:1.6 }}>Sign in securely with Google. XR-Code never sees your password.</p>
    </section>
  </main>
}

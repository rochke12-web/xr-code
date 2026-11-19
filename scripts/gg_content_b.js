// Tutorial content — sections 5-11 (routes, button, test, production, troubleshooting, security).
const { h1, body, step, codeBlock, codeCaption, dataTable } = require("./gg_help");

const B = [];

// ── 5. Part 3 - start route ──
B.push(h1("5. Part 3 - The Start Route"));
B.push(body("This route is the door out of your app and into Google's consent screen. It mirrors src/app/auth/discord/start/route.ts structurally: resolve the pinned origin, generate a random state, stash it in a short-lived HttpOnly cookie, and redirect. The popup=1 flag matches how your gate already opens Discord sign-in in a popup - the app UI lives inside the shell iframe, and Google refuses to be framed, so a popup is the only path."));
B.push(codeCaption("File 1 - src/app/auth/google/start/route.ts (new, complete)"));
B.push(codeBlock([
  "import { NextResponse } from \"next/server\";",
  "import crypto from \"crypto\";",
  "import { XR_SECRETS } from \"@/lib/xrsecrets\";",
  "import { safeOrigin, originOf } from \"@/lib/xrorigins\";",
  "",
  "// Step 1 of the Google OAuth (authorization-code flow): bounce the user to",
  "Google's consent screen with a CSRF state cookie. Mirrors the Discord start",
  "route; the popup flag matches how the gate opens Discord sign-in.",
  "export async function GET(req: Request) {",
  "  const cid = process.env.GOOGLE_CLIENT_ID || XR_SECRETS.GOOGLE_CLIENT_ID;",
  "  // redirect_uri MUST match one registered in the Google console (Part 1).",
  "  // Pin the origin where gateway headers lie, same idea as Discord's pin.",
  "  const origin =",
  "    process.env.GOOGLE_REDIRECT_ORIGIN || XR_SECRETS.GOOGLE_REDIRECT_ORIGIN",
  "    || originOf(req);",
  "  const url = new URL(req.url);",
  "  const popup = url.searchParams.get(\"popup\") === \"1\";",
  "  const state = crypto.randomBytes(16).toString(\"hex\");",
  "  const params = new URLSearchParams({",
  "    client_id: cid,",
  "    response_type: \"code\",",
  "    redirect_uri: origin + \"/auth/google/callback\",",
  "    scope: \"openid email profile\",",
  "    state,",
  "    prompt: \"select_account\",  // always show the account picker",
  "  });",
  "  const res = NextResponse.redirect(",
  "    \"https://accounts.google.com/o/oauth2/v2/auth?\" + params.toString(), 302);",
  "  res.headers.append(\"Set-Cookie\",",
  "    `xr_gstate=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);",
  "  if (popup) res.headers.append(\"Set-Cookie\",",
  "    \"xr_popup=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=600\");",
  "  return res;",
  "}",
]));
B.push(body([{ t: "Two deliberate choices: " }, { t: "scope: \"openid email profile\"", code: true }, { t: " is the minimal identity set - no Drive, no contacts, nothing your app does not need. And " }, { t: "prompt: \"select_account\"", code: true }, { t: " keeps sign-ins one click without silently picking last time's account, so testing with two accounts stays easy. The state cookie lives 600 seconds, exactly like the Discord one." }], { after: 200 }));

// ── 6. Part 4 - callback route ──
B.push(h1("6. Part 4 - The Callback Route"));
B.push(body("Google sends the user back here with ?code=...&state=.... The route validates the state against the cookie, exchanges the code directly with Google over HTTPS, validates the returned identity claims, and mints the standard xr_ds cookie through mintToken - the same helper Discord uses. From this point on, the rest of XR-Code treats the user like any verified member."));
B.push(codeCaption("File 2 - src/app/auth/google/callback/route.ts (new, complete)"));
B.push(codeBlock([
  "import { NextResponse } from \"next/server\";",
  "import { mintToken, authCookie } from \"@/lib/xrauth\";",
  "import { XR_SECRETS } from \"@/lib/xrsecrets\";",
  "import { originOf } from \"@/lib/xrorigins\";",
  "",
  "function seeOther(location: string, cookies: string[] = []) {",
  "  const h = new Headers({ Location: location });",
  "  cookies.forEach(c => h.append(\"Set-Cookie\", c));",
  "  return new Response(null, { status: 302, headers: h });",
  "}",
  "",
  "function cookieVal(req: Request, name: string): string {",
  "  return (req.headers.get(\"cookie\") || \"\").split(/;\\s*/)",
  "    .map(p => p.split(\"=\")).find(p => p[0] === name)?.[1] || \"\";",
  "}",
  "",
  "export async function GET(req: Request) {",
  "  const url = new URL(req.url);",
  "  const self = originOf(req);",
  "  const cid = process.env.GOOGLE_CLIENT_ID || XR_SECRETS.GOOGLE_CLIENT_ID;",
  "  const cs = process.env.GOOGLE_CLIENT_SECRET || XR_SECRETS.GOOGLE_CLIENT_SECRET;",
  "  const origin =",
  "    process.env.GOOGLE_REDIRECT_ORIGIN || XR_SECRETS.GOOGLE_REDIRECT_ORIGIN || self;",
  "",
  "  // 1. CSRF: the state we got back must be the one we set, one-time use.",
  "  const state = url.searchParams.get(\"state\") || \"\";",
  "  if (!state || state !== cookieVal(req, \"xr_gstate\"))",
  "    return seeOther(\"/?dserr=state\");",
  "",
  "  // 2. The user pressed Cancel on the consent screen.",
  "  if (url.searchParams.get(\"error\")) return seeOther(\"/?dserr=denied\");",
  "",
  "  const code = url.searchParams.get(\"code\") || \"\";",
  "  if (!code) return seeOther(\"/?dserr=setup\");",
  "",
  "  // 3. Exchange the code with Google - the code never touches the browser.",
  "  const tokRes = await fetch(\"https://oauth2.googleapis.com/token\", {",
  "    method: \"POST\",",
  "    headers: { \"content-type\": \"application/x-www-form-urlencoded\" },",
  "    body: new URLSearchParams({",
  "      code, client_id: cid, client_secret: cs,",
  "      redirect_uri: origin + \"/auth/google/callback\",",
  "      grant_type: \"authorization_code\",",
  "    }),",
  "  });",
  "  const tok = await tokRes.json();",
  "  if (!tok.id_token) return seeOther(\"/?dserr=exchange\");",
  "",
  "  // 4. Decode and validate the identity claims.",
  "  const claims = JSON.parse(",
  "    Buffer.from(tok.id_token.split(\".\")[1], \"base64url\").toString());",
  "  const issOk = claims.iss === \"accounts.google.com\"",
  "    || claims.iss === \"https://accounts.google.com\";",
  "  const audOk = claims.aud === cid;",
  "  const expOk = typeof claims.exp === \"number\" && Date.now() / 1000 < claims.exp;",
  "  if (!issOk || !audOk || !expOk) return seeOther(\"/?dserr=identity\");",
  "",
  "  // 5. Membership policy: allow-list when configured, open otherwise.",
  "  const allow = (XR_SECRETS.GOOGLE_ALLOW_EMAILS || process.env.GOOGLE_ALLOW_EMAILS || \"\")",
  "    .split(\",\").map(s => s.trim().toLowerCase()).filter(Boolean);",
  "  if (allow.length && !allow.includes(String(claims.email).toLowerCase()))",
  "    return seeOther(\"/?dserr=denied\");",
  "",
  "  // 6. Mint the SAME cookie Discord mints - prefix the uid so providers",
  "  // stay distinguishable in chat stores and logs.",
  "  const uid = \"g:\" + String(claims.sub);",
  "  const res = seeOther(",
  "    cookieVal(req, \"xr_popup\") === \"1\" ? \"/auth/google/done\" : \"/?dsok=1\",",
  "    [authCookie(mintToken(uid)),",
  "     \"xr_gstate=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0\"]);",
  "  return res;",
  "}",
]));
B.push(body([{ t: "Why the " }, { t: "g:", code: true }, { t: " prefix on the uid: Discord tokens carry raw Discord user ids. Prefixing keeps the two providers distinguishable in chat stores, keys, and logs without touching verifyDiscord(). Why three claim checks: Google signs the id_token, but you still verify the audience (aud = your client id, so the token was minted for your app), the issuer, and the expiry - the minimum honest validation for a token obtained directly from Google's token endpoint over TLS." }], { after: 160 }));
B.push(body("For popup sign-ins the callback redirects to a tiny self-closing page. Your Discord flow has its own done page with the same job - reuse it if you like, or add this minimal one:", { after: 80 }));
B.push(codeCaption("File 3 - src/app/auth/google/done/page.tsx (new, tiny)"));
B.push(codeBlock([
  "\"use client\";",
  "import { useEffect } from \"react\";",
  "",
  "export default function GoogleDone() {",
  "  useEffect(() => {",
  "    const t = setTimeout(() => window.close(), 900);",
  "    return () => clearTimeout(t);",
  "  }, []);",
  "  return <p style={{ padding: 40, fontFamily: \"system-ui\" }}>",
  "    Signed in with Google - closing...</p>;",
  "}",
]));

// ── 7. Part 5 - the button ──
B.push(h1("7. Part 5 - The Continue-with-Google Button"));
B.push(body("The members-only gate (the ds-lock card in the payload) already opens Discord sign-in in a popup and then polls the cookie check until the gate unlocks. The Google button reuses that exact wiring with a different URL - nothing else changes. In the gate markup, duplicate the Discord button block and change three things: the popup URL becomes /auth/google/start?popup=1, the window name becomes xr-google, and the label becomes Continue with Google. Keep the polling call to /api/discord/check as-is - it only inspects the xr_ds HMAC, so it unlocks for Google members too."));
B.push(body([{ t: "Concretely, wherever the Discord button calls something like " }, { t: "window.open('/auth/discord/start?popup=1' + ret, 'xr-discord', ...)", code: true }, { t: ", the Google twin calls " }, { t: "window.open('/auth/google/start?popup=1', 'xr-google', 'width=480,height=640')", code: true }, { t: ". After editing the payload source, rebuild it the usual way so the obfuscated bundle picks up the new button." }], { after: 200 }));

// ── 8. Part 6 - test locally ──
B.push(h1("8. Part 6 - Test It Locally"));
B.push(body("Run through this checklist in order - each step verifies one layer, so a failure points at a specific part.", { after: 160 }));
B.push(step("steps-test", [{ t: "Start the dev server (" }, { t: "npm run dev", code: true }, { t: ") and open " }, { t: "http://localhost:3000", code: true }, { t: ". The members gate should show both buttons." }]));
B.push(step("steps-test", [{ t: "Click Continue with Google. A 480x640 popup opens on Google's consent screen. If the browser blocks it, allow popups for localhost and click again." }]));
B.push(step("steps-test", [{ t: "Pick an account that is on your Test users list (Part 1, step 6) and approve the consent prompt." }]));
B.push(step("steps-test", [{ t: "The popup should redirect to your callback, flash the done page, and close itself. The gate on the main page unlocks within a second or two." }]));
B.push(step("steps-test", [{ t: "In DevTools > Network, find the /auth/google/callback request: status 302, and the response Set-Cookie header contains xr_ds=v1.g:... - the g: prefix proves the Google mint path ran." }]));
B.push(step("steps-test", [{ t: "Send a chat message. Every AI route guards itself with the same verifyDiscord() - if the brain answers, the cookie is valid end to end." }]));
B.push(step("steps-test", [{ t: "Reload the page once more: no consent screen reappears (prompt=select_account only shows the picker), and the session persists across restarts for 30 days." }]));
B.push(body("Also test the failure paths once: cancel on the consent screen (you land back with dserr=denied and no cookie), and add a random stranger's Gmail to the popup while it is allow-listed (dserr=denied again).", { after: 200 }));

// ── 9. Part 7 - production ──
B.push(h1("9. Part 7 - Ship It to Production"));
B.push(step("steps-prod", [{ t: "In the Google console, open the same OAuth client and add a second " }, { t: "Authorized redirect URI", code: true }, { t: " for your deployed origin, e.g. " }, { t: "https://your-domain/auth/google/callback", code: true }, { t: ". Add the production origin to " }, { t: "Authorized JavaScript origins", code: true }, { t: " as well." }]));
B.push(step("steps-prod", [{ t: "Set the same four GOOGLE_* environment variables on the host, and set GOOGLE_REDIRECT_ORIGIN to your pinned production origin so gateway headers cannot steer the OAuth flow." }]));
B.push(step("steps-prod", [{ t: "Keep GOOGLE_ALLOW_EMAILS populated in production - open-door Google login means any Gmail account can burn your AI quota." }]));
B.push(step("steps-prod", [{ t: "Rebuild and deploy the payload with the new gate button, then run the full Part 6 checklist against the production URL." }]));
B.push(step("steps-prod", [{ t: "When your user count grows past testing, publish the consent screen (Google Console > OAuth consent screen > PUBLISH APP). With only basic scopes (openid, email, profile) no verification review is required." }]));
B.push(step("steps-prod", [{ t: "Optional hardening: restrict the client to your production origin only (remove the localhost URIs), and keep a second client for local dev." }]));

// ── 10. Part 8 - troubleshooting ──
B.push(h1("10. Part 8 - When Something Breaks"));
B.push(...dataTable("Table 3 - Common errors and the fix", ["Symptom", "Cause", "Fix"], [
  ["redirect_uri_mismatch", "Console URIs do not match what the app sends (scheme, host, port, path, or a trailing slash differs)", "Copy the exact origin the browser shows, fix the URI in the console, and check GOOGLE_REDIRECT_ORIGIN pinning"],
  ["invalid_client / 401 on token exchange", "Wrong Client ID or Secret, or env vars not loaded", "Re-paste both values, restart the dev server, confirm the client type is Web application"],
  ["Access blocked: app has not completed verification", "Your Gmail is not a Test user while the app is in Testing", "Add the address under Test users (Part 1, step 6), or publish the app"],
  ["dserr=state", "The xr_gstate cookie was missing, expired (10 min), or two tabs raced", "Retry once in one tab; check the browser is not blocking cookies"],
  ["Popup never opens", "window.open outside a click handler, or popup blocker", "Open the popup inside the click event; allow popups for the site"],
  ["Popup closes but gate stays locked", "Cookie set, but the check request fails or is cached", "Hard-refresh; confirm /api/discord/check returns ok in Network"],
  ["No xr_ds in DevTools > Application > Cookies", "Callback bounced before minting (look for dserr in the URL)", "Decode the dserr code and match it against Table 3 rows above"],
  ["Locked out after a month", "The 30-day re-verify cap did its job", "Sign in again - expected behavior, not a bug"],
], [24, 34, 42]));

// ── 11. security checklist ──
B.push(h1("11. Security Checklist"));
B.push(body("Ten things to confirm before you call this done. Each maps to a concrete choice in the code above.", { after: 160 }));
B.push(step("steps-sec", [{ t: "The state cookie is random per attempt, HttpOnly, SameSite=Lax, 600-second TTL, and burned at the callback - CSRF covered." }]));
B.push(step("steps-sec", [{ t: "The authorization code is exchanged server-side only; the browser never sees or stores it." }]));
B.push(step("steps-sec", [{ t: "The id_token claims are validated: iss is accounts.google.com, aud is your client id, exp is in the future." }]));
B.push(step("steps-sec", [{ t: "The Client Secret exists only in XR_SECRETS or env - never in client bundles, localStorage, or git history." }]));
B.push(step("steps-sec", [{ t: "GOOGLE_ALLOW_EMAILS is set in production so the Google door admits a known list, not every Gmail." }]));
B.push(step("steps-sec", [{ t: "Google uids are prefixed (g:...) so they can never collide with Discord uids in stores." }]));
B.push(step("steps-sec", [{ t: "XR_AUTH_SECRET is a long random string - it signs both providers' cookies, so leaking it forges sessions for everyone." }]));
B.push(step("steps-sec", [{ t: "The xr_ds cookie stays HttpOnly with a 30-day cap - monthly re-verification inherited from the Discord gate." }]));
B.push(step("steps-sec", [{ t: "Scopes stay minimal: openid, email, profile - no Drive, no contacts, no calendar." }]));
B.push(step("steps-sec", [{ t: "Logout clears xr_ds for both providers via the existing /api/discord/logout route." }]));
B.push(body("That is the whole integration: two route files, one tiny done page, four secret values, one button. Because every guard in XR-Code hangs off the signed xr_ds cookie rather than the provider, Google members and Discord members share the same room from the first line of code.", { after: 0 }));

module.exports = { B };

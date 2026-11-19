// Tutorial content — sections 1-4 (intro, build map, Google Console, secrets).
const { h1, h2, body, step, codeBlock, codeCaption, dataTable } = require("./gg_help");

const A = [];

// ── 1. How login works today ──
A.push(h1("1. How Login Works in XR-Code Today"));
A.push(body("XR-Code already has a complete login system. The Discord gate gives every verified member a short signed token stored in an HttpOnly cookie named xr_ds. The token looks like v1.{uid}.{iat}.{signature} - the signature is an HMAC-SHA256 over the user id and the issue time, keyed by XR_AUTH_SECRET on the server. Every AI route (chat, imagine, video, keys, and so on) calls verifyDiscord(req) and simply refuses to answer when the cookie is missing, tampered with, or older than 30 days. The 30-day cap means members re-verify once a month, which keeps live membership truthful."));
A.push(body("The important design detail for this tutorial: verifyDiscord() only checks the HMAC - it does not care who minted the token. If a new Google flow mints the exact same xr_ds cookie via the existing mintToken(uid) helper, then every protected route in the app accepts Google members automatically, with zero changes to the API layer. That is exactly what this tutorial wires up."));
A.push(...dataTable("Table 1 - The pieces we keep and reuse", ["Piece", "Where it lives", "Role in the Google flow"], [
  ["mintToken(uid)", "src/lib/xrauth.ts", "Signs the xr_ds cookie value - reused unchanged"],
  ["verifyDiscord(req)", "src/lib/xrauth.ts", "Guards all AI routes - reused unchanged"],
  ["authCookie(token)", "src/lib/xrauth.ts", "Builds the Set-Cookie header (HttpOnly, 30 days)"],
  ["safeOrigin / b64u / originOf", "src/lib/xrorigins.ts", "Origin pinning and state packing for the popup flow"],
  ["Discord start + callback", "src/app/auth/discord/*", "The structural template this tutorial mirrors"],
  ["/api/discord/check", "src/app/api/discord/check", "Cookie check the gate polls - provider-agnostic"],
  ["/api/discord/logout", "src/app/api/discord/logout", "Clears xr_ds - works for Google logins too"],
], [24, 30, 46]));
A.push(body("One consequence worth stating plainly: after this tutorial you have two doors into the same room. Discord login keeps checking guild membership through Discord, while Google login admits whoever your Google policy allows (by default: only the email addresses you allow-list). The cookie they mint is identical, so the rest of the app cannot tell the difference.", { after: 200 }));

// ── 2. What you will build ──
A.push(h1("2. What You Will Build"));
A.push(body("The Google flow is the same authorization-code flow Discord uses, point for point. Your browser opens a popup to /auth/google/start, which redirects to Google's consent screen with a CSRF state cookie in place. Google sends the user back to /auth/google/callback with a one-time code. The callback exchanges the code directly with Google over HTTPS (the code never touches the browser), validates the returned identity, mints the standard xr_ds cookie, and closes the popup - at which point the gate UI re-checks the cookie and lets the user in."));
A.push(...dataTable("Table 2 - Files touched in this tutorial", ["File", "New or edit", "Purpose"], [
  ["src/app/auth/google/start/route.ts", "New", "Redirects to the Google consent screen, sets the state cookie"],
  ["src/app/auth/google/callback/route.ts", "New", "Exchanges the code, validates the identity, mints xr_ds"],
  ["src/lib/xrsecrets.ts", "Edit", "Adds the four Google entries to XR_SECRETS"],
  [".env", "Edit", "Same values as environment variables for dev"],
  ["Gate button markup", "Edit", "Adds a Continue with Google button beside the Discord one"],
], [38, 14, 48]));
A.push(body("Nothing else changes. No middleware edits, no API route edits, no payload rebuild is required for the server flow - only the two small route files and the button.", { after: 200 }));

// ── 3. Part 1 - Google Cloud Console ──
A.push(h1("3. Part 1 - Create the Google OAuth Client"));
A.push(body("Google hands out OAuth credentials through its Cloud Console. Follow these steps one by one - each numbered step is one click or one form on console.cloud.google.com. The whole sequence takes about five minutes.", { after: 160 }));
A.push(step("steps-gcp", [{ t: "Open " }, { t: "https://console.cloud.google.com", code: true }, { t: " in your browser and sign in with any Google account (it becomes the owner of the OAuth app)." }]));
A.push(step("steps-gcp", [{ t: "Top-left, open the project picker, then click " }, { t: "NEW PROJECT", code: true }, { t: ". Name it " }, { t: "xr-code", code: true }, { t: " and click " }, { t: "CREATE", code: true }, { t: ". Wait a few seconds while Google provisions it." }]));
A.push(step("steps-gcp", [{ t: "Select the xr-code project in the project picker so every following step happens inside it." }]));
A.push(step("steps-gcp", [{ t: "In the left menu go to " }, { t: "APIs and Services > OAuth consent screen", code: true }, { t: ". If asked, choose " }, { t: "External", code: true }, { t: " as the user type, then click " }, { t: "CREATE", code: true }, { t: "." }]));
A.push(step("steps-gcp", [{ t: "On the consent screen form fill in: App name = " }, { t: "XR-Code", code: true }, { t: ", User support email = your address, Developer contact = your address. Click " }, { t: "SAVE AND CONTINUE", code: true }, { t: " on each page (Scopes and Test users can stay as-is for now)." }]));
A.push(step("steps-gcp", [{ t: "While still on the consent screen, open the " }, { t: "Test users", code: true }, { t: " page, click " }, { t: "ADD USERS", code: true }, { t: ", and add the Gmail addresses you want to allow during testing. Google blocks everyone else while the app is in Testing status - this is the number one cause of Access blocked errors later." }]));
A.push(step("steps-gcp", [{ t: "Now go to " }, { t: "APIs and Services > Credentials", code: true }, { t: ", click " }, { t: "+ CREATE CREDENTIALS", code: true }, { t: ", and pick " }, { t: "OAuth client ID", code: true }, { t: "." }]));
A.push(step("steps-gcp", [{ t: "For " }, { t: "Application type", code: true }, { t: " choose " }, { t: "Web application", code: true }, { t: " and name it " }, { t: "XR-Code local", code: true }, { t: " (you can rename it later or create a second client for production)." }]));
A.push(step("steps-gcp", [{ t: "Under " }, { t: "Authorized JavaScript origins", code: true }, { t: " click " }, { t: "ADD URI", code: true }, { t: " and enter " }, { t: "http://localhost:3000", code: true }, { t: "." }]));
A.push(step("steps-gcp", [{ t: "Under " }, { t: "Authorized redirect URIs", code: true }, { t: " click " }, { t: "ADD URI", code: true }, { t: " and enter " }, { t: "http://localhost:3000/auth/google/callback", code: true }, { t: ". This must match the callback path exactly - no trailing slash." }]));
A.push(step("steps-gcp", [{ t: "Click " }, { t: "CREATE", code: true }, { t: ". A dialog shows the Client ID (ends in .apps.googleusercontent.com) and the Client Secret. Copy both now - you will paste them into the app in Part 2." }]));
A.push(step("steps-gcp", [{ t: "Optional but recommended: download the client JSON from the Credentials list and keep it somewhere private as a backup." }]));
A.push(body([{ t: "When you deploy (Part 7) you will come back to this screen and add one more redirect URI for your production domain, for example " }, { t: "https://your-domain/auth/google/callback", code: true }, { t: ". Google rejects callbacks to unregistered URIs with the famous redirect_uri_mismatch error - so register every origin you actually serve from." }], { after: 200 }));

// ── 4. Part 2 - Secrets ──
A.push(h1("4. Part 2 - Store the Secrets"));
A.push(body("XR-Code keeps its server-side secrets in src/lib/xrsecrets.ts inside an exported XR_SECRETS object, with environment variables as the first fallback. Add four entries - two required, two optional. The optional GOOGLE_REDIRECT_ORIGIN pins the OAuth origin on hosts where gateway headers lie about the hostname (your deployment already does this for Discord); GOOGLE_ALLOW_EMAILS turns Google login from open-door into an allow-list, which is what you want for a members app.", { after: 160 }));
A.push(codeCaption("Snippet 1 - add to the XR_SECRETS object in src/lib/xrsecrets.ts"));
A.push(codeBlock([
  "GOOGLE_CLIENT_ID: \"xxxxxxxx.apps.googleusercontent.com\",   // Part 1, step 12",
  "GOOGLE_CLIENT_SECRET: \"GOCSPX-xxxxxxxxxxxxxxxx\",          // Part 1, step 12",
  "GOOGLE_REDIRECT_ORIGIN: \"\",   // e.g. https://your-domain - empty on localhost",
  "GOOGLE_ALLOW_EMAILS: \"\",      // comma-separated allow-list - empty = allow all",
]));
A.push(body([{ t: "Then mirror the same four values in " }, { t: ".env", code: true }, { t: " so local dev picks them up without touching the secrets file:" }]));
A.push(codeCaption("Snippet 2 - add to .env in the project root"));
A.push(codeBlock([
  "GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com",
  "GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx",
  "GOOGLE_ALLOW_EMAILS=you@gmail.com,your-friend@gmail.com",
]));
A.push(body("Restart the dev server after editing .env - Next.js only reads it at boot. Keep the Client Secret strictly server-side: it must never appear in the payload HTML, in localStorage, or in any client bundle. Both secrets stay inside API-route code, which runs on the server only.", { after: 200 }));

module.exports = { A };

import { NextResponse } from "next/server";
import crypto from "crypto";
import { promises as fs } from "fs";
import path from "path";

// Step 2 of the Discord OAuth: Discord sends the user back here with ?code=...
// We exchange the code server-side (client secret stays on the server), fetch
// the user identity, create a session file, and set an HttpOnly session cookie.
// The access token NEVER reaches the browser.

function cookieVal(req: Request, name: string): string {
  const c = req.headers.get("cookie") || "";
  for (const part of c.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return "";
}

function originOf(req: Request): string {
  const u = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || u.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || u.host;
  return `${proto}://${host}`;
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const origin = originOf(req);
  const code = u.searchParams.get("code") || "";
  const state = u.searchParams.get("state") || "";
  const stCookie = cookieVal(req, "xr_state");

  // CSRF check + Discord-side denial
  if (u.searchParams.get("error") || !code || !state || !stCookie || state !== stCookie) {
    return NextResponse.redirect(origin + "/#discord=failed", 302);
  }

  const secret = process.env.DISCORD_CLIENT_SECRET || "";
  if (!secret) {
    return new NextResponse(
      "<!doctype html><html><head><meta charset='utf-8'><title>XR-Code</title></head>" +
      "<body style=\"font-family:sans-serif;background:#0a0a0a;color:#eee;padding:48px;max-width:640px;margin:0 auto\">" +
      "<h2 style='color:#8f7bff'>XR-Code &times; Discord — one setup step left</h2>" +
      "<p>The server is missing <b style='color:#5865F2'>DISCORD_CLIENT_SECRET</b>.</p>" +
      "<p>Open the Discord developer console &rarr; your app &rarr; OAuth2 &rarr; copy the Client Secret " +
      "(Reset Secret if needed) and put it in the server's <code>.env.local</code> as " +
      "<code>DISCORD_CLIENT_SECRET=...</code>. Then press Link Discord again.</p>" +
      "<p style='color:#888'>Also make sure both callback URLs are registered under OAuth2 &rarr; Redirects.</p>" +
      "</body></html>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID || "1569008720661315645",
        client_secret: secret,
        grant_type: "authorization_code",
        code,
        redirect_uri: origin + "/auth/discord/callback",
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!tokenRes.ok) return NextResponse.redirect(origin + "/#discord=token", 302);
    const tok = await tokenRes.json();

    const meRes = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bearer ${String(tok.access_token)}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!meRes.ok) return NextResponse.redirect(origin + "/#discord=identify", 302);
    const me = await meRes.json();

    const sid = crypto.randomBytes(24).toString("hex");
    const dir = path.join(process.cwd(), "data", "sessions");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, sid + ".json"),
      JSON.stringify({
        id: String(me.id),
        name: me.global_name || me.username || "Discord user",
        avatar: me.avatar || "",
        access_token: tok.access_token,
        refresh_token: tok.refresh_token || "",
        ts: Date.now(),
      })
    );

    const out = NextResponse.redirect(origin + "/#discord=linked", 302);
    out.headers.append("Set-Cookie", `xr_sess=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
    return out;
  } catch {
    return NextResponse.redirect(origin + "/#discord=error", 302);
  }
}

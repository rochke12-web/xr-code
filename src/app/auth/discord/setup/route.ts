// Setup helper — shows the EXACT strings the owner must register in the
// Discord Developer Portal to make one-click verification work on this
// deployment, plus the status of the server-side config.
import { NextResponse } from "next/server";
import { originOf } from "@/lib/xrorigins";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function GET(req: Request) {
  // originOf: forwarded headers first — raw req.url is the internal bind
  // address on the hosted brain, which would advertise an unregistrable URI
  const self = originOf(req);
  const cid = process.env.DISCORD_CLIENT_ID || "1569300109790023772";
  const uris = [...new Set([self + "/auth/discord/callback", "http://localhost:3000/auth/discord/callback"])];
  const secret = process.env.DISCORD_CLIENT_SECRET || "";
  const secretState = secret
    ? `<span class="ok">client secret: saved &#10003;</span>`
    : `<span class="bad">client secret: MISSING — paste DISCORD_CLIENT_SECRET in .env.local</span>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>XR Code · Discord setup</title>
<style>
  body{background:#0a0a0a;color:#fafafa;font-family:ui-monospace,'JetBrains Mono',Menlo,monospace;
       display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
  .card{width:min(680px,92vw);background:#111111;border:1px solid #262626;border-radius:18px;padding:34px 32px}
  h1{font-size:15px;letter-spacing:.2em;text-transform:uppercase;margin:0 0 6px}
  .sub{color:#8f8f8f;font-size:12.5px;line-height:1.7;margin:0 0 22px}
  ol{margin:0 0 18px;padding-left:20px;color:#d4d4d4;font-size:13px;line-height:1.9}
  .uri{display:flex;gap:8px;align-items:center;background:#0b0b0b;border:1px solid #262626;border-radius:10px;
       padding:10px 12px;margin:8px 0;font-size:12px;word-break:break-all}
  .uri code{flex:1;color:#fafafa}
  .cp{background:#1a1a1a;border:1px solid #333333;color:#fafafa;border-radius:8px;padding:6px 12px;
      cursor:pointer;font-size:11px;font-family:inherit}
  .cp:hover{border-color:#ffffff}
  .st{font-size:12.5px;margin-top:18px;line-height:1.8}
  .ok{color:#ffffff}.bad{color:#8f8f8f}
  .btn{display:inline-block;margin-top:16px;background:#ffffff;color:#0a0a0a;border:none;border-radius:10px;
       padding:11px 20px;font-size:13px;font-weight:600;cursor:pointer;text-decoration:none;font-family:inherit}
  .btn:hover{background:#e5e5e5}
  .note{color:#8f8f8f;font-size:11.5px;line-height:1.7;margin-top:14px}
</style></head><body><div class="card">
<h1>Discord verification setup</h1>
<p class="sub">Discord only redirects to addresses registered in your app's portal. Register the two callback
addresses below and one-click verification works on this deployment.</p>
<ol>
  <li>Open <b>discord.com/developers/applications</b> &rarr; your app &rarr; <b>OAuth2</b>.</li>
  <li>Under <b>Redirects</b>, press <b>Add Redirect</b> and paste each address below.</li>
  <li>Press <b>Save Changes</b>, then test verification.</li>
</ol>
${uris.map(u => `<div class="uri"><code>${esc(u)}</code><button class="cp" onclick="cp(this)">copy</button></div>`).join("")}
<button class="cp" onclick="location.href='/auth/discord/setup'">refresh</button>
<a class="btn" href="/auth/discord">Test verify &#8599;</a>
<div class="st">${secretState}</div>
<p class="note">Manual verify (paste-the-link flow on the lock screen) works with the localhost redirect alone —
but every path needs the client secret saved on the server first.</p>
</div>
<script>function cp(b){navigator.clipboard.writeText(b.parentElement.querySelector('code').textContent)
  .then(()=>{b.textContent='copied';setTimeout(()=>b.textContent='copy',1200)})}</script>
</body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

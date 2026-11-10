// Origin helpers shared by the Discord OAuth routes.

// The ONE origin resolver every auth route shares. The runtime (Aliyun FC
// brain) rewrites req.url to the internal bind address (http://0.0.0.0:3000)
// while keeping the public host in the forwarded headers — deriving origins
// from req.url alone leaked that internal address into redirects the browser
// follows (ERR_ADDRESS_INVALID). Forwarded headers win; req.url is the last
// resort for bare localhost dev where no proxy stands in front.
export function originOf(req: Request): string {
  const u = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || u.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || u.host;
  const derived = safeOrigin(`${proto}://${host}`);
  return derived || u.origin;
}

// only a bare http(s) origin is a legitimate ret/handoff target
export function safeOrigin(raw: string): string {
  try {
    const u = new URL(raw);
    if (/^https?:$/.test(u.protocol) && (u.pathname === "/" || u.pathname === "") && !u.search && !u.hash) {
      return u.origin;
    }
  } catch { /* not a URL */ }
  return "";
}

// base64url without padding — safe inside an OAuth state value (no '.' in the
// alphabet, so callback parsing splits on the first dot without ambiguity)
export function b64u(s: string): string {
  return Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function unb64u(s: string): string {
  try {
    return atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  } catch {
    return "";
  }
}

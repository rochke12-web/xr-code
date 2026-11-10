// Origin helpers shared by the Discord OAuth routes.

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

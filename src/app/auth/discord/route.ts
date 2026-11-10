// Legacy Discord verification entry (kept for old links — the setup page and
// earlier payloads point here). It no longer builds its own authorize URL:
// that build derived redirect_uri from raw req.url, which is the INTERNAL
// bind address (http://0.0.0.0:3000) on the hosted brain, and it carried the
// deprecated guilds.join scope. Delegate to /auth/discord/start, which owns
// the pinned-origin redirect_uri, the CSRF state cookie and prompt=consent.
import { originOf } from "@/lib/xrorigins";

export async function GET(req: Request) {
  const ret = originOf(req);
  const loc = "/auth/discord/start?ret=" + encodeURIComponent(ret);
  return new Response(null, {
    status: 302,
    headers: { Location: loc },
  });
}

import { NextResponse } from "next/server";
import { verifyDiscord } from "../../../lib/xrauth";
import { putKey, delKey, listKeys, PROVIDERS } from "../../../lib/xrkeys";

// BYOK — the user's own API keys, encrypted server-side per Discord account.
// GET    → masked listing
// POST   { provider, key, model?, baseUrl? } → save/replace
// DELETE { provider } → remove
export async function GET(req: Request) {
  const gv = verifyDiscord(req);
  if (!gv.ok) return NextResponse.json({ ok: false, error: "auth", auth: gv.error }, { status: 401 });
  return NextResponse.json({ ok: true, keys: listKeys(gv.uid || ""), providers: Object.keys(PROVIDERS) });
}

export async function POST(req: Request) {
  const gv = verifyDiscord(req);
  if (!gv.ok) return NextResponse.json({ ok: false, error: "auth", auth: gv.error }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { provider?: unknown; key?: unknown; model?: unknown; baseUrl?: unknown };
  const provider = typeof body.provider === "string" ? body.provider : "";
  const key = typeof body.key === "string" ? body.key : "";
  const model = typeof body.model === "string" ? body.model.slice(0, 120) : undefined;
  const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl.slice(0, 200) : undefined;
  const r = putKey(gv.uid || "", provider, key, model, baseUrl);
  return NextResponse.json({ ...r, keys: r.ok ? listKeys(gv.uid || "") : undefined }, { status: r.ok ? 200 : 400 });
}

export async function DELETE(req: Request) {
  const gv = verifyDiscord(req);
  if (!gv.ok) return NextResponse.json({ ok: false, error: "auth", auth: gv.error }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { provider?: unknown };
  const ok = delKey(gv.uid || "", typeof body.provider === "string" ? body.provider : "");
  return NextResponse.json({ ok, keys: listKeys(gv.uid || "") });
}

import { NextResponse } from "next/server";
import { verifyRequest } from "../../../lib/request-auth";
import { putKey, delKey, listKeys, PROVIDERS } from "../../../lib/xrkeys";

// BYOK — the user's own API keys, encrypted server-side per Google account
// and stored in Firestore (xrByokKeys/{uid}) so they survive Vercel deploys.
// GET    → masked listing (never the raw key)
// POST   { provider, key, model?, baseUrl? } → save/replace
// DELETE { provider } → remove
export async function GET(req: Request) {
  const gv = await verifyRequest(req);
  if (!gv.ok) return NextResponse.json({ ok: false, error: "auth", auth: gv.error }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, keys: await listKeys(gv.uid || ""), providers: Object.keys(PROVIDERS) });
  } catch {
    return NextResponse.json({ ok: false, error: "storage_unavailable" }, { status: 503 });
  }
}

export async function POST(req: Request) {
  const gv = await verifyRequest(req);
  if (!gv.ok) return NextResponse.json({ ok: false, error: "auth", auth: gv.error }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { provider?: unknown; key?: unknown; model?: unknown; baseUrl?: unknown };
  const provider = typeof body.provider === "string" ? body.provider : "";
  const key = typeof body.key === "string" ? body.key : "";
  const model = typeof body.model === "string" ? body.model.slice(0, 120) : undefined;
  const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl.slice(0, 200) : undefined;
  try {
    const r = await putKey(gv.uid || "", provider, key, model, baseUrl);
    return NextResponse.json({ ...r, keys: r.ok ? await listKeys(gv.uid || "") : undefined }, { status: r.ok ? 200 : 400 });
  } catch {
    return NextResponse.json({ ok: false, error: "storage_unavailable" }, { status: 503 });
  }
}

export async function DELETE(req: Request) {
  const gv = await verifyRequest(req);
  if (!gv.ok) return NextResponse.json({ ok: false, error: "auth", auth: gv.error }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { provider?: unknown };
  try {
    const ok = await delKey(gv.uid || "", typeof body.provider === "string" ? body.provider : "");
    return NextResponse.json({ ok, keys: await listKeys(gv.uid || "") });
  } catch {
    return NextResponse.json({ ok: false, error: "storage_unavailable" }, { status: 503 });
  }
}

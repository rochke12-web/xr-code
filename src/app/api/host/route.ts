import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Hosted engine — the Z.ai API key is entered ONCE and stored in the database.
// GET    /api/host → { hosted, provider, model }   (the key itself is NEVER returned)
// POST   /api/host → save/replace the key          { apiKey: "sk-..." }
// DELETE /api/host → remove the hosted key (back to demo mode / first-run window)

const KEY_RE = /^[A-Za-z0-9._:~\/+=-]{10,}$/;

function cleanKey(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\s+/g, "")            // spaces, tabs, NBSP…
    .replace(/[^\x21-\x7E]/g, "");  // zero-width chars, BOM, curly quotes, CJK…
}

export async function GET() {
  try {
    const row = await db.hostConfig.findUnique({ where: { provider: "zai" } });
    return NextResponse.json({ hosted: !!row, provider: "zai", model: row ? row.model : null });
  } catch {
    return NextResponse.json({ hosted: false, provider: "zai", model: null });
  }
}

export async function POST(req: Request) {
  let body: { apiKey?: string } | null = null;
  try {
    body = await req.json();
  } catch {
    /* no / invalid body */
  }
  const key = cleanKey(body?.apiKey);
  if (!KEY_RE.test(key)) {
    return NextResponse.json({ ok: false, error: "invalid key" }, { status: 400 });
  }
  const row = await db.hostConfig.upsert({
    where: { provider: "zai" },
    update: { apiKey: key, model: "glm-4.6" },
    create: { provider: "zai", apiKey: key, model: "glm-4.6" },
  });
  return NextResponse.json({ ok: true, hosted: true, provider: "zai", model: row.model });
}

export async function DELETE() {
  try {
    await db.hostConfig.deleteMany({ where: { provider: "zai" } });
  } catch {
    /* nothing to delete */
  }
  return NextResponse.json({ ok: true, hosted: false });
}

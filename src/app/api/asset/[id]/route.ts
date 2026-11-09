import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// GET /api/asset/[id] → a generated image (png) from db/assets
// ids are 20-char hex tokens produced by the chat route itself
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9]{16,24}$/.test(id))
    return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });
  // stable asset dir OUTSIDE .next — matches the chat route (survives rebuilds)
  const file = path.resolve(process.cwd(), (process.env.XR_ASSET_DIR ? "" : "../../") + "db/assets", id + ".png");
  try {
    const buf = fs.readFileSync(file);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }
}

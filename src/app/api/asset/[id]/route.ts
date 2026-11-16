import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { assetDir } from "../../../../lib/asset-dir";

// GET /api/asset/[id] → a generated asset from db/assets (png / jpeg / mp4)
// ids are 20-char hex tokens produced by the chat route or the video-edit driver
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9]{16,24}$/.test(id))
    return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });
  // stable asset dir OUTSIDE .next — matches the chat route (survives rebuilds)
  for (const ext of ["png", "mp4"]) {
    const file = path.resolve(assetDir(), id + "." + ext);
    try {
      const buf = fs.readFileSync(file);
      // sniff the magic bytes, don't trust names: png, jpeg, or an mp4 ftyp box
      const isPng = buf[0] === 0x89 && buf[1] === 0x50;
      const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
      const isMp4 = buf.length > 12 && buf.toString("latin1", 4, 8) === "ftyp";
      if (!isPng && !isJpeg && !isMp4) continue;
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": isMp4 ? "video/mp4" : isPng ? "image/png" : "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch {
      continue;
    }
  }
  return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
}

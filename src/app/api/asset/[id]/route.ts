import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { assetDir } from "../../../../lib/asset-dir";

// GET /api/asset/[id] → a generated asset from db/assets
//  · legacy ids: 20-char hex tokens (png / jpeg / mp4, magic-byte sniffed)
//  · produced files: <hex20>__<name.ext> — any extension the brain's file/zip
//    factory wrote, served as a download with the original filename kept
const MIME: Record<string, string> = {
  txt: "text/plain", md: "text/markdown", markdown: "text/markdown", csv: "text/csv",
  xml: "application/xml", json: "application/json", yaml: "text/yaml", yml: "text/yaml",
  toml: "text/plain", ini: "text/plain", cfg: "text/plain", log: "text/plain", sql: "text/sql",
  html: "text/html", htm: "text/html", css: "text/css", js: "text/javascript",
  mjs: "text/javascript", ts: "text/typescript", tsx: "text/typescript", jsx: "text/typescript",
  py: "text/x-python", rb: "text/x-ruby", go: "text/x-go", rs: "text/x-rust",
  java: "text/x-java", kt: "text/x-kotlin", c: "text/x-c", h: "text/x-c",
  cpp: "text/x-c++src", hpp: "text/x-c++src", cs: "text/x-csharp", php: "text/x-php",
  sh: "text/x-shellscript", bat: "text/plain", ps1: "text/plain", swift: "text/x-swift",
  zip: "application/zip", pdf: "application/pdf", svg: "image/svg+xml",
  wasm: "application/wasm", webm: "video/webm", mp3: "audio/mpeg", wav: "audio/wav",
};

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // produced files: <hex20>__<name.ext> — strict charset, no traversal
  const m = id.match(/^([a-f0-9]{16,24})__([A-Za-z0-9][A-Za-z0-9._-]{0,100})$/);
  if (m) {
    const file = path.resolve(assetDir(), m[1] + "__" + m[2]);
    if (!file.startsWith(path.resolve(assetDir()))) return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });
    try {
      const buf = fs.readFileSync(file);
      const ext = (m[2].split(".").pop() || "").toLowerCase();
      const mime = MIME[ext] || "application/octet-stream";
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": mime,
          "Content-Disposition": `attachment; filename="${m[2]}"`,
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
    }
  }

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

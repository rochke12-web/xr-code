import "server-only";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { assetDir } from "./asset-dir";
import { firebaseDb } from "./firebase-server";

// Asset storage that works on BOTH hosts:
//  · local / sandbox mirror — plain files under db/assets (fast, persistent)
//  · Vercel — the serverless filesystem is READ-ONLY outside /tmp, so every
//    db/assets write threw EROFS and every finished paint was discarded
//    ("The art models are warming up" was a file-write error, not a gateway
//    one). There we store the image in Firestore `assets/<id>` and serve it
//    back through /api/asset/<id>.
// Firestore caps a document at 1 MiB, so anything big is JPEG-compressed
// first (a 16:9 photo lands around 150-500 KB as JPEG).

export const ON_VERCEL = !!process.env.VERCEL;

async function toJpeg(buf: Buffer): Promise<Buffer> {
  if (buf[0] === 0xff && buf[1] === 0xd8) return buf; // already jpeg
  const { default: sharp } = await import("sharp");
  for (const q of [90, 80, 65]) {
    const out = await sharp(buf).jpeg({ quality: q }).toBuffer();
    if (out.length < 650_000) return out; // b64 lands under the 1 MiB doc cap
  }
  return buf; // give up on shrinking — caller decides
}

async function saveToFirestore(buf: Buffer, mime: string): Promise<string | null> {
  try {
    const id = randomUUID().replace(/-/g, "").slice(0, 20);
    const b64 = buf.toString("base64");
    if (b64.length > 950_000) return null;
    await firebaseDb().collection("assets").doc(id).set({ mime, data: b64, ts: Date.now() });
    return `/api/asset/${id}`;
  } catch (e) {
    console.error("[asset-store] firestore save failed:", String((e as Error)?.message || e).slice(0, 140));
    return null;
  }
}

function saveToDisk(buf: Buffer, ext: string): string {
  fs.mkdirSync(assetDir(), { recursive: true });
  const id = randomUUID().replace(/-/g, "").slice(0, 20);
  fs.writeFileSync(path.join(assetDir(), id + "." + ext), buf);
  return `/api/asset/${id}`;
}

/** Store a generated asset; returns the /api/asset/<id> URL it serves at. */
export async function saveAsset(buf: Buffer, ext: "png" | "jpg"): Promise<string> {
  if (ON_VERCEL) {
    // read-only FS — Firestore only. Compress png → jpeg to stay in the doc cap.
    const bytes = ext === "png" ? await toJpeg(buf) : buf;
    const via = await saveToFirestore(bytes, "image/jpeg");
    if (via) return via;
    // Firestore unavailable → last resort: /tmp (works while this instance lives)
    return saveToDisk(bytes, "jpg");
  }
  return saveToDisk(buf, ext);
}

/* ---------- generic byte store — mp4 / zip / any produced file ---------- */
// Firestore caps a DOCUMENT at 1 MiB, so anything bigger (a 5s mp4 is 1-4 MB)
// is split across `assets/<id>/c/<i>` chunk docs of 512 KB source bytes each
// (b64 inflates 4/3 — 512 KB → ~683 KB b64, safely under the cap).

const MIME_EXT: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "video/mp4": "mp4", "audio/mpeg": "mp3",
  "audio/wav": "wav", "application/zip": "zip", "application/pdf": "pdf",
  "text/plain": "txt", "text/markdown": "md", "application/json": "json",
  "text/csv": "csv", "text/html": "html",
};

function extOf(mime: string): string {
  return MIME_EXT[mime] || "bin";
}

/** Store arbitrary bytes (any size) + optional download filename. */
export async function saveAssetBytes(buf: Buffer, mime: string, name?: string): Promise<string> {
  if (ON_VERCEL) {
    try {
      const id = randomUUID().replace(/-/g, "").slice(0, 20);
      const b64 = buf.toString("base64");
      const base: Record<string, unknown> = { mime, name: name || null, size: buf.length, ts: Date.now() };
      if (b64.length <= 900_000) {
        await firebaseDb().collection("assets").doc(id).set({ ...base, data: b64 });
      } else {
        const CH = 512 * 1024; // source bytes per chunk
        const n = Math.ceil(buf.length / CH);
        const doc = firebaseDb().collection("assets").doc(id);
        const batch = firebaseDb().batch();
        batch.set(doc, { ...base, chunks: n });
        for (let i = 0; i < n; i++) {
          batch.set(doc.collection("c").doc(String(i)), { d: buf.subarray(i * CH, (i + 1) * CH).toString("base64") });
        }
        await batch.commit();
      }
      return name ? `/api/asset/${id}__${name}` : `/api/asset/${id}`;
    } catch (e) {
      console.error("[asset-store] bytes save failed:", String((e as Error)?.message || e).slice(0, 140));
      // last resort: /tmp — serves while this instance is warm
      return saveToDisk(buf, extOf(mime));
    }
  }
  // local disk keeps both conventions: plain <id>.<ext> and produced <id>__<name>
  const id = randomUUID().replace(/-/g, "").slice(0, 20);
  const store = name ? `${id}__${name}` : `${id}.${extOf(mime)}`;
  fs.mkdirSync(assetDir(), { recursive: true });
  fs.writeFileSync(path.join(assetDir(), store), buf);
  return `/api/asset/${store}`;
}

/** Read back ANY stored asset (Firestore single/chunked first, disk second). */
export async function loadAssetBytes(id: string): Promise<{ buf: Buffer; mime: string; name: string | null } | null> {
  if (ON_VERCEL) {
    try {
      // produced-file URLs carry `__<name>` — the doc lives under the bare hex id
      const baseId = id.match(/^([a-f0-9]{16,24})__/)?.[1] || id;
      const ref = firebaseDb().collection("assets").doc(baseId);
      const snap = await ref.get();
      const d = snap.data() as { data?: string; chunks?: number; mime?: string; name?: string | null } | undefined;
      if (d?.data) return { buf: Buffer.from(d.data, "base64"), mime: d.mime || "application/octet-stream", name: d.name || null };
      if (d?.chunks && d.chunks > 0) {
        const parts: Buffer[] = [];
        for (let i = 0; i < d.chunks; i++) {
          const c = await ref.collection("c").doc(String(i)).get();
          const cd = c.data() as { d?: string } | undefined;
          if (!cd?.d) throw new Error(`chunk ${i} missing`);
          parts.push(Buffer.from(cd.d, "base64"));
        }
        return { buf: Buffer.concat(parts), mime: d.mime || "application/octet-stream", name: d.name || null };
      }
    } catch (e) {
      console.error("[asset-store] bytes read failed:", String((e as Error)?.message || e).slice(0, 140));
    }
  }
  // disk fallback — plain <id>.<ext> first…
  const tail = id.includes(".") ? (id.split(".").pop() || "").toLowerCase() : "";
  const plainMime: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", mp4: "video/mp4",
    mp3: "audio/mpeg", wav: "audio/wav", zip: "application/zip", pdf: "application/pdf",
  };
  if (tail && plainMime[tail]) {
    try {
      return { buf: fs.readFileSync(path.join(assetDir(), id)), mime: plainMime[tail], name: null };
    } catch { /* fall through */ }
  }
  // …then produced <hex>__<name> convention
  const m = id.match(/^([a-f0-9]{16,24})__([A-Za-z0-9][A-Za-z0-9._-]{0,100})$/);
  if (m) {
    try {
      const buf = fs.readFileSync(path.join(assetDir(), m[1] + "__" + m[2]));
      const ext = (m[2].split(".").pop() || "").toLowerCase();
      return { buf, mime: plainMime[ext] || "application/octet-stream", name: m[2] };
    } catch { /* fall through */ }
  }
  return null;
}

/* ---------- minimal ZIP writer (STORE method, no compression) ---------- */
// The `zip` binary exists on the sandbox host but NOT in Vercel lambdas —
// the file factory needs a dependency-free way to bundle downloads.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Build a standard .zip from {name, data} entries (stored, no compression). */
export function makeZip(files: { name: string; data: Buffer }[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  const dosTime = 0, dosDate = 0x21; // 1980-01-01, harmless fixed stamp
  for (const f of files) {
    const nameB = Buffer.from(f.name, "utf8");
    const crc = crc32(f.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);        // version needed
    local.writeUInt16LE(0x0800, 6);    // flags: UTF-8 names
    local.writeUInt16LE(0, 8);         // method: STORE
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(f.data.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(nameB.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, nameB, f.data);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(0, 10);
    cen.writeUInt16LE(dosTime, 12); cen.writeUInt16LE(dosDate, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(f.data.length, 20); cen.writeUInt32LE(f.data.length, 24);
    cen.writeUInt16LE(nameB.length, 28);
    cen.writeUInt32LE(0, 42);          // local header offset (patched below)
    central.push(cen, nameB);
    offset += 30 + nameB.length + f.data.length;
  }
  // patch central-directory local-header offsets
  let running = 0;
  for (let i = 0; i < central.length; i += 2) {
    central[i].writeUInt32LE(running, 42);
    running += 30 + central[i + 1].length + files[i / 2].data.length;
  }
  const cdSize = central.reduce((s, b) => s + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...central, eocd]);
}

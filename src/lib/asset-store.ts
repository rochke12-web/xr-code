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
  for (const q of [82, 65, 50]) {
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

/** Read an asset back (Firestore first, disk second). Returns null if unknown. */
export async function loadAsset(id: string): Promise<{ buf: Buffer; mime: string } | null> {
  if (ON_VERCEL) {
    try {
      const snap = await firebaseDb().collection("assets").doc(id).get();
      const d = snap.data();
      if (d?.data) return { buf: Buffer.from(d.data, "base64"), mime: d.mime || "image/jpeg" };
    } catch (e) {
      console.error("[asset-store] firestore read failed:", String((e as Error)?.message || e).slice(0, 140));
    }
  }
  // disk fallback (local writes live here; Vercel /tmp last-resort too)
  for (const [ext, mime] of [["png", "image/png"], ["jpg", "image/jpeg"], ["jpeg", "image/jpeg"], ["mp4", "video/mp4"]] as const) {
    try {
      const buf = fs.readFileSync(path.join(assetDir(), id + "." + ext));
      return { buf, mime };
    } catch { continue; }
  }
  return null;
}

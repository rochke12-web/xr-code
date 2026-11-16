import { NextResponse } from "next/server";
import { APP_B64 } from "../../payload";
import { XR_SECRETS } from "../../../lib/xrsecrets";

// /api/shell — serves the decrypted private build to the app iframe.
// The XOR cipher key stays SERVER-SIDE (xrsecrets.ts, parsed by
// build_private.py at build time): the browser bundle carries neither the
// key nor the ciphertext-decoding code, so grabbing the site's JS no longer
// hands out both halves of the puzzle. Obfuscation inside the payload is the
// second layer; view-source shows only this route's response, which is the
// same HTML the iframe would render anyway.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const K = process.env.XR_PAYLOAD_KEY || XR_SECRETS.XR_PAYLOAD_KEY;

export async function GET() {
  try {
    if (!K || !APP_B64) throw new Error("payload or key missing");
    const bin = Buffer.from(APP_B64, "base64").toString("latin1");
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i) ^ K.charCodeAt(i % K.length);
    const html = new TextDecoder("utf-8").decode(bytes);
    if (!html.includes("XR-Code")) throw new Error("payload decode sanity failed");
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "shell unavailable" }, { status: 503 });
  }
}

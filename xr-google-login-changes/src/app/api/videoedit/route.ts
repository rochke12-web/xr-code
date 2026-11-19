import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import { verifyRequest } from "../../../lib/request-auth";

// POST /api/videoedit — start a brain-driven edit of an uploaded talking-head video.
//   multipart/form-data: file=<video>, style?, captions?, lang?, noSilence?, pause?
//   or JSON: { b64, name?, style?, captions?, lang? }
//   → { ok, id } (job lives in db/videoedits/<id>/, driver runs detached)
// GET /api/videoedit?id=<id> → { ok, job } (live status from job.json)

const ROOT = process.cwd();
const JOBS = path.join(ROOT, "db", "videoedits");
const MAX_BYTES = 200_000_000;
const STYLES = new Set(["warm-canvas", "creator-motion-graphics", "clean-tech", "software-walkthrough", "data-story", "chalk-talk", "pop-info"]);

function jobDir(id: string) {
  return path.join(JOBS, id);
}

export async function POST(req: Request) {
  // Discord gate — verified member only. Fail closed.
  const gv = await verifyRequest(req);
  if (!gv.ok)
    return NextResponse.json({ ok: false, error: "auth", auth: gv.error }, { status: 401 });
  try {
    let buf: Buffer | null = null;
    let name = "src.mp4";
    let opts: Record<string, string> = {};
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const f = form.get("file");
      if (f && typeof f === "object" && "arrayBuffer" in (f as File)) {
        const ab = await (f as File).arrayBuffer();
        buf = Buffer.from(ab);
        const fn = (f as File).name || "";
        if (/\.(mp4|mov|mkv|webm|m4v)$/i.test(fn)) name = fn;
      }
      for (const k of ["style", "captions", "lang", "noSilence", "pause", "noCuts"]) {
        const v = form.get(k);
        if (typeof v === "string") opts[k] = v;
      }
    } else {
      const body = (await req.json().catch(() => null)) as { b64?: string; name?: string } | null;
      const b64 = String(body?.b64 || "").replace(/^data:[^,]+,/, "").replace(/\s/g, "");
      if (b64.length < 100) return NextResponse.json({ ok: false, error: "no video" }, { status: 400 });
      if (b64.length > MAX_BYTES) return NextResponse.json({ ok: false, error: "video too large (200MB cap)" }, { status: 413 });
      buf = Buffer.from(b64, "base64");
      if (body?.name) name = body.name;
      const url = new URL(req.url);
      for (const k of ["style", "captions", "lang", "noSilence", "pause", "noCuts"]) {
        const v = url.searchParams.get(k);
        if (v) opts[k] = v;
      }
    }
    if (!buf || buf.length < 1000)
      return NextResponse.json({ ok: false, error: "no video" }, { status: 400 });
    if (buf.length > MAX_BYTES)
      return NextResponse.json({ ok: false, error: "video too large (200MB cap)" }, { status: 413 });
    // only real video containers — sniff, don't trust the name
    const isMp4 = buf.length > 12 && buf.toString("latin1", 4, 8) === "ftyp";
    const isMkv = buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
    const isWebm = isMkv;
    if (!isMp4 && !isMkv && !isWebm)
      return NextResponse.json({ ok: false, error: "not an mp4/mov/mkv/webm file" }, { status: 400 });

    const id = crypto.randomBytes(10).toString("hex");
    const dir = jobDir(id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name.replace(/\.[^.]+$/, "") + ".mp4"), buf);
    const videoFile = name.replace(/\.[^.]+$/, "") + ".mp4";
    const style = STYLES.has(opts.style || "") ? opts.style : "warm-canvas";
    fs.writeFileSync(path.join(dir, "job.json"), JSON.stringify({
      id, status: "queued", step: "queued", note: "", progress: 0,
      videoFile, style,
      captions: opts.captions === "yes" ? "yes" : "no",
      lang: opts.lang || "en",
      noSilence: opts.noSilence === "1" || opts.noSilence === "true",
      noCuts: opts.noCuts === "1" || opts.noCuts === "true",
      pause: opts.pause ? Number(opts.pause) || undefined : undefined,
      createdAt: Date.now(),
    }));
    // detached driver — survives the HTTP response; all state is on disk
    const child = spawn(process.execPath, ["scripts/videoedit_driver.mjs", id], {
      cwd: ROOT, detached: true, stdio: "ignore",
      env: process.env,
    });
    child.unref();
    return NextResponse.json({ ok: true, id, status: "/api/videoedit?id=" + id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "upload failed: " + String(e).slice(0, 200) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const gv = await verifyRequest(req);
  if (!gv.ok)
    return NextResponse.json({ ok: false, error: "auth", auth: gv.error }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[a-f0-9]{16,24}$/.test(id))
    return NextResponse.json({ ok: false, error: "bad id" }, { status: 400 });
  try {
    const j = JSON.parse(fs.readFileSync(path.join(jobDir(id), "job.json"), "utf8"));
    return NextResponse.json({ ok: true, job: j });
  } catch {
    return NextResponse.json({ ok: false, error: "no such job" }, { status: 404 });
  }
}

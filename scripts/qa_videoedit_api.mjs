// QA: /api/videoedit E2E — upload a real talking-head test video through the
// app's HTTP API, poll the job, verify the final.mp4 asset + the brain's cut
// decisions (planted mistakes: opener filler, false start, redo cue, silences).
import { createHmac } from "crypto";
import fs from "fs";

const LIVE = "http://localhost:3000";
const UID = "123456789012345678";
const VIDEO = process.argv[2] || "/tmp/vetest/talkinghead.mp4";

function mint(uid) {
  const src = fs.readFileSync("/home/z/my-project/src/lib/xrsecrets.ts", "utf8");
  const m = src.match(/XR_AUTH_SECRET:\s*"([^"]+)"/);
  const secret = m ? m[1] : "xr-dev-secret-change-me";
  const iat = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", secret).update(uid + "." + iat).digest("hex").slice(0, 40);
  return `v1.${uid}.${iat}.${sig}`;
}
const cookie = "xr_ds=" + mint(UID);

const fails = [];
const ok = (c, l, e) => { console.log((c ? "PASS" : "FAIL") + "  " + l + (e ? "  [" + e + "]" : "")); if (!c) fails.push(l); };

(async () => {
  // 1. upload (multipart, like a browser form)
  const buf = fs.readFileSync(VIDEO);
  const form = new FormData();
  form.append("file", new Blob([buf], { type: "video/mp4" }), "talkinghead.mp4");
  form.append("style", "warm-canvas");
  form.append("captions", "no");
  form.append("lang", "en");
  const up = await fetch(LIVE + "/api/videoedit", { method: "POST", headers: { cookie }, body: form });
  const upj = await up.json().catch(() => null);
  ok(up.status === 200 && upj?.ok && upj?.id, "T1 upload accepted", `status=${up.status} id=${upj?.id}`);
  if (!upj?.id) { console.log(fails.length + " FAILED"); process.exit(1); }

  // 2. poll until done (max 22 min)
  const t0 = Date.now();
  let job = null, lastStep = "";
  while (Date.now() - t0 < 22 * 60000) {
    await new Promise(r => setTimeout(r, 15000));
    const r = await fetch(LIVE + "/api/videoedit?id=" + upj.id, { headers: { cookie } });
    const d = await r.json().catch(() => null);
    job = d?.job;
    if (!job) { ok(false, "T2 status readable", "bad status response"); break; }
    const line = `${job.step} ${job.progress}% ${job.note || ""}`;
    if (line !== lastStep) { console.log(`  [${Math.round((Date.now() - t0) / 1000)}s]`, line); lastStep = line; }
    if (job.status === "done" || job.status === "error") break;
  }
  ok(job?.status === "done", "T3 job completed", JSON.stringify(job && { status: job.status, error: job.error, step: job.step }));
  if (job?.status !== "done") {
    console.log("mistakeCuts so far:", JSON.stringify(job?.mistakeCuts || null));
    console.log(fails.length + " FAILED"); process.exit(1);
  }

  // 3. the brain's editor decisions
  const mc = job.mistakeCuts || [];
  ok(mc.length >= 2, "T4 brain found the planted mistakes", JSON.stringify(mc));
  const whyAll = mc.map(x => (x.why || "") + " ").join(" ");
  ok(/recording|filler|opener|start/i.test(whyAll) || /retake|redo|false|again/i.test(whyAll),
    "T5 cut reasons look right", whyAll.slice(0, 120));

  // 4. final asset: served as a playable mp4
  const res = await fetch(LIVE + job.result.url);
  const ab = Buffer.from(await res.arrayBuffer());
  const magic = ab.length > 12 && ab.toString("latin1", 4, 8) === "ftyp";
  ok(res.status === 200 && magic && ab.length > 100000 && (res.headers.get("content-type") || "").includes("video/mp4"),
    "T6 final.mp4 served", `${res.status} ${res.headers.get("content-type")} ${(ab.length / 1048576).toFixed(1)}MB`);
  fs.writeFileSync("/tmp/vetest/final_api.mp4", ab);

  // 5. shorter than the source (silences + mistakes actually removed)
  const { execSync } = await import("child_process");
  const dur = (f) => parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 ${f}`).toString());
  const src = dur(VIDEO), out = dur("/tmp/vetest/final_api.mp4");
  ok(out < src - 2, "T7 edit actually shortened the video", `${src.toFixed(1)}s -> ${out.toFixed(1)}s`);
  console.log("  visionQA:", JSON.stringify(job.visionQA));
  console.log("  cutSummary:", JSON.stringify(job.cutSummary && { orig: job.cutSummary.original_seconds, edited: job.cutSummary.edited_seconds, removed: job.cutSummary.removed_seconds, by: job.cutSummary.removed_by_reason }));
  console.log(fails.length ? `\n${fails.length} FAILED` : "\nALL PASS");
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error("QA crashed:", e); process.exit(1); });

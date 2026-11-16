// QA: /api/video E2E — advanced video generation through the real :3000.
//  clip mode : 1 shot → mp4 asset (~5s)
//  story mode: brain storyboard → 2 scenes → concat + TTS narration → ~10s asset
import { createHmac } from "crypto";
import fs from "fs";
import { execSync } from "child_process";

const LIVE = "http://localhost:3000";
const UID = "123456789012345678";
function mintCookie(uid) {
  const src = fs.readFileSync("/home/z/my-project/src/lib/xrsecrets.ts", "utf8");
  const m = src.match(/XR_AUTH_SECRET:\s*"([^"]+)"/);
  const secret = m ? m[1] : "xr-dev-secret-change-me";
  const iat = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", secret).update(uid + "." + iat).digest("hex").slice(0, 40);
  return "xr_ds=" + "v1." + uid + "." + iat + "." + sig;
}
const cookie = mintCookie(UID);
const fails = [];
const ok = (c, l, e) => { console.log((c ? "PASS" : "FAIL") + "  " + l + (e ? "  [" + e + "]" : "")); if (!c) fails.push(l); };
const dur = (f) => parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 ${f}`).toString());

async function start(body) {
  const r = await fetch(LIVE + "/api/video", { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}
async function poll(id, maxMin) {
  const t0 = Date.now();
  let job = null, last = "";
  while (Date.now() - t0 < maxMin * 60000) {
    await new Promise(r => setTimeout(r, 15000));
    const d = (await (await fetch(LIVE + "/api/video?id=" + id, { headers: { cookie } })).json())?.job;
    job = d;
    if (!job) return null;
    const line = `${job.step} ${job.progress}% ${job.note || ""}`;
    if (line !== last) { console.log(`  [${Math.round((Date.now() - t0) / 1000)}s]`, line); last = line; }
    if (job.status === "done" || job.status === "error") return job;
  }
  return job;
}
async function grab(url, file) {
  const res = await fetch(LIVE + url);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(file, buf);
  const magic = buf.length > 12 && buf.toString("latin1", 4, 8) === "ftyp";
  return { status: res.status, magic, size: buf.length, ct: res.headers.get("content-type") || "" };
}

(async () => {
  // ---- clip mode ----
  const c = await start({ mode: "clip", prompt: "Golden retriever puppy catching a red frisbee on a sunny beach, dynamic camera", size: "1920x1080", withAudio: true });
  ok(c?.ok && c?.id, "V1 clip job accepted", `id=${c?.id}`);
  if (c?.id) {
    const j = await poll(c.id, 25);
    ok(j?.status === "done", "V2 clip job completed", JSON.stringify(j && { status: j.status, error: j.error }));
    if (j?.status === "done") {
      const g = await grab(j.result.url, "/tmp/vetest/api_clip.mp4");
      ok(g.status === 200 && g.magic && g.size > 100000 && g.ct.includes("video/mp4"), "V3 clip asset served", `${g.ct} ${(g.size / 1048576).toFixed(1)}MB`);
      const d = dur("/tmp/vetest/api_clip.mp4");
      ok(d > 3.5 && d < 7, "V4 clip duration ~5s", d.toFixed(1) + "s");
    }
  }

  // ---- story mode (advanced: brain storyboard + narration) ----
  const s = await start({
    mode: "story", scenes: 2, narrate: true, size: "1920x1080",
    prompt: "A 20-second style mini-ad for a cozy corner coffee shop called Mira: morning light, steam, friendly barista, first sip bliss",
  });
  ok(s?.ok && s?.id, "V5 story job accepted", `id=${s?.id}`);
  if (s?.id) {
    const j = await poll(s.id, 35);
    ok(j?.status === "done", "V6 story job completed", JSON.stringify(j && { status: j.status, error: j.error }));
    if (j?.status === "done") {
      const g = await grab(j.result.url, "/tmp/vetest/api_story.mp4");
      ok(g.status === 200 && g.magic && g.size > 200000, "V7 story asset served", `${(g.size / 1048576).toFixed(1)}MB`);
      const d = dur("/tmp/vetest/api_story.mp4");
      ok(d > 8, "V8 story duration = scenes x 5s", d.toFixed(1) + "s");
      ok(Array.isArray(j.storyboard) && j.storyboard.length >= 2 && (j.storyboard[0].narration || "") !== "",
        "V9 brain storyboard with narration", JSON.stringify((j.storyboard || []).map(x => x.narration || "")).slice(0, 160));
      // narration really audible? measure mean volume in the audio stream
      const v = execSync("ffmpeg -i /tmp/vetest/api_story.mp4 -af volumedetect -f null - 2>&1 | grep mean_volume || true").toString().trim();
      console.log("  audio:", v || "(none)");
      ok(/mean_volume/.test(v), "V10 audio track present", v.slice(0, 80));
      console.log("  storyboard scenes:", (j.storyboard || []).length);
    }
  }
  console.log(fails.length ? `\n${fails.length} FAILED` : "\nALL PASS");
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error("QA crashed:", e); process.exit(1); });

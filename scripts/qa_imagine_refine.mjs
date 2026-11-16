#!/usr/bin/env node
// QA: Imagine conversational refinement — short idea → rich prompt; follow-up
// tweak → edits the previous prompt instead of starting over (Gemini-style).
import crypto from "crypto";
import fs from "fs";

const UID = "123456789012345678";
function mint(uid) {
  const src = fs.readFileSync("/home/z/my-project/src/lib/xrsecrets.ts", "utf8");
  const m = src.match(/XR_AUTH_SECRET:\s*"([^"]+)"/);
  const secret = m ? m[1] : "xr-dev-secret-change-me";
  const iat = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac("sha256", secret).update(uid + "." + iat).digest("hex").slice(0, 40);
  return "v1." + uid + "." + iat + "." + sig;
}
const cookie = "xr_ds=" + mint(UID);
const BASE = "http://localhost:3000";

async function imagine(body) {
  const res = await fetch(BASE + "/api/imagine", {
    method: "POST", headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, d: await res.json().catch(() => null) };
}

// 1. fresh short idea — enhancer must expand it (no painting: use a bogus
//    style/size? no — enhancement runs BEFORE paint; paint cost is real.
//    We only assert the enhanced text, but the route paints first... To avoid
//    burning a painting, we accept the paint (one image) and check fields.
const t0 = Date.now();
let r = await imagine({ prompt: "a cat on the moon", style: "auto", size: "1024x1024" });
console.log("fresh:", r.status, "in", Date.now() - t0, "ms");
console.log("enhanced:", (r.d?.enhanced || "").slice(0, 160));
console.log("rich enough:", (r.d?.enhanced || "").length > 60 ? "PASS" : "FAIL");
const base = r.d?.enhanced || "";

// 2. refine: "make it night" — must keep the cat+moon, add night
const t1 = Date.now();
r = await imagine({ prompt: "make it night with neon stars", style: "auto", size: "1024x1024", base });
console.log("refine:", r.status, "in", Date.now() - t1, "ms");
console.log("refined:", (r.d?.enhanced || "").slice(0, 160));
const e = (r.d?.enhanced || "").toLowerCase();
const keepCat = e.includes("cat"), keepMoon = e.includes("moon"), night = e.includes("night") || e.includes("neon");
console.log("refine keeps subject:", keepCat && keepMoon ? "PASS" : "FAIL", "| applies tweak:", night ? "PASS" : "FAIL");

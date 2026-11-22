// Smoke test for the pure-JS zip writer + local byte-store conventions.
import { writeFileSync } from "fs";
import { execSync } from "child_process";

process.env.NODE_ENV = "development";
const m = await import("../src/lib/asset-store.ts");

const zip = m.makeZip([
  { name: "hello.txt", data: Buffer.from("hello world", "utf8") },
  { name: "data.bin", data: Buffer.concat([Buffer.alloc(100000, 7), Buffer.from([1, 2, 3])]) },
]);
writeFileSync("/tmp/smoke-test.zip", zip);
const t = execSync("unzip -t /tmp/smoke-test.zip 2>&1").toString();
console.log(t.trim().split("\n").slice(-3).join("\n"));
const out = execSync("unzip -p /tmp/smoke-test.zip hello.txt").toString();
console.log("content ok:", out === "hello world", "| zip bytes:", zip.length);
if (!/No errors detected/.test(t) || out !== "hello world") process.exit(1);
console.log("ZIP OK");

// byte-store local roundtrip (Vercel branch needs Firestore creds — code-reviewed only)
const url = await m.saveAssetBytes(Buffer.from("mp4-bytes-here".repeat(100)), "video/mp4");
const id = url.split("/").pop()!.split("__")[0];
const back = await m.loadAssetBytes(id);
console.log("roundtrip:", back ? back.buf.length : "FAIL", "bytes, mime:", back?.mime, "| url:", url.slice(0, 30) + "…");
const u2 = await m.saveAssetBytes(Buffer.from("file content"), "application/octet-stream", "readme.txt");
const id2 = u2.split("/").pop()!;
const b2 = await m.loadAssetBytes(id2);
console.log("named roundtrip:", b2 ? b2.name + " " + b2.buf.length + "B" : "FAIL", "| url ok:", u2.endsWith("__readme.txt"));

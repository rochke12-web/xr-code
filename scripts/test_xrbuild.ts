// E2E for the XR-Code binary factory — runs the PRODUCTION code path
// (src/lib/xrbuild.ts) directly through bun, no gateway calls, no quota burn.
// Verifies: C exe, C++ exe, and a .dll all come out as real PE32+ binaries.
import { produceBinary } from "../src/lib/xrbuild";
import fs from "fs";
import path from "path";

const HELLO_C = `#include <stdio.h>
int main(void){ printf("XR-Code exe build OK\\n"); for(int i=1;i<=3;i++) printf("count %d\\n", i); return 0; }
`;
const HELLO_CPP = `#include <iostream>
#include <vector>
int main(){ std::vector<int> v{2,4,6}; int s=0; for(int x:v) s+=x; std::cout << "cpp sum " << s << std::endl; return 0; }
`;
const DLL_C = `#include <windows.h>
__declspec(dllexport) int xr_add(int a,int b){ return a+b; }
BOOL WINAPI DllMain(HINSTANCE h, DWORD r, LPVOID l){ return TRUE; }
`;

function peCheck(p: string, label: string): void {
  const buf = fs.readFileSync(p);
  const mz = buf[0] === 0x4d && buf[1] === 0x5a; // "MZ"
  const peOff = buf.readUInt32LE(0x3c);
  const pe = buf.toString("latin1", peOff, peOff + 4) === "PE\0\0";
  const machine = buf.readUInt16LE(peOff + 4); // 0x8664 = x64
  console.log(
    `${label}: ${path.basename(p)} size=${buf.size} MZ=${mz} PE=${pe} machine=0x${machine.toString(16)}`
  );
  if (!mz || !pe || machine !== 0x8664) {
    console.error(`FAIL: ${label} is not a Windows x64 PE binary`);
    process.exit(1);
  }
}

async function main() {
  const t0 = Date.now();
  const exe = await produceBinary({
    action: "exe",
    name: "hello-world",
    lang: "c",
    files: [{ name: "main.c", content: HELLO_C }],
  });
  if (!exe) { console.error("FAIL: C exe compile returned null"); process.exit(1); }
  console.log("C exe:", JSON.stringify(exe));

  const exeCpp = await produceBinary({
    action: "exe",
    name: "cpp-tool",
    lang: "cpp",
    files: [{ name: "main.cpp", content: HELLO_CPP }],
  });
  if (!exeCpp) { console.error("FAIL: C++ exe compile returned null"); process.exit(1); }
  console.log("C++ exe:", JSON.stringify(exeCpp));

  const dll = await produceBinary({
    action: "dll",
    name: "xr-lib",
    lang: "c",
    files: [{ name: "xr_lib.c", content: DLL_C }],
  });
  if (!dll) { console.error("FAIL: dll compile returned null"); process.exit(1); }
  console.log("DLL:", JSON.stringify(dll));

  // compile-failure path must fall back to a source zip (the dispatcher does
  // that; here we just verify produceBinary itself returns null cleanly)
  const bad = await produceBinary({
    action: "exe",
    name: "broken",
    lang: "c",
    files: [{ name: "main.c", content: "int main(void){ this is not C }" }],
  });
  console.log("broken-source produceBinary:", bad === null ? "null (correct)" : "UNEXPECTED RESULT");

  peCheck(path.join(process.cwd(), "db/assets", exe.url.split("/").pop() || ""), "C exe");
  peCheck(path.join(process.cwd(), "db/assets", exeCpp.url.split("/").pop() || ""), "C++ exe");
  peCheck(path.join(process.cwd(), "db/assets", dll.url.split("/").pop() || ""), "DLL");

  console.log("ALL PASS in", Date.now() - t0, "ms");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

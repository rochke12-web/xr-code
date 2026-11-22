import fs from "fs";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { saveAssetBytes } from "./asset-store";

// XR-Code binary factory — the brain can ship REAL Windows executables.
// A zig toolchain (zig cc is a drop-in C/C++ cross-compiler with Windows
// targets built in) lives in <repo>/toolchain. The tarball is committed;
// the extracted tree is created lazily on first use, exactly like db/ is
// created lazily on the runner. The user's code is only ever COMPILED here —
// produced binaries are stored and served for download, never executed.
//   exe  → zig cc   -target x86_64-windows-gnu  (console subsystem, main())
//   dll  → zig cc -shared -target x86_64-windows-gnu (__declspec(dllexport))
// stdlib-only sources; the factory stores the result as <hex20>__<name>.exe
// in the shared asset dir so /api/asset serves it like every other artifact.

const SAFE_STORE = /^[A-Za-z0-9._-]{1,100}$/;
const SRC_RE = /\.(c|cpp|cc|cxx|h|hpp)$/i;

// project root from any cwd: dev runs at the root, the hosted standalone
// server chdirs into .next/standalone — two levels up is the repo root
// (same resolution the asset-dir helper uses for db/).
function repoRoot(): string {
  const cwd = process.cwd();
  if (cwd.includes(`${path.sep}.next`)) return path.resolve(cwd, "..", "..");
  return cwd;
}

function zigBin(): string | null {
  const z = path.join(repoRoot(), "toolchain", "zig", "zig");
  try {
    return fs.existsSync(z) ? z : null;
  } catch {
    return null;
  }
}

// one-time bootstrap: extract the committed tarball into toolchain/ (~3s),
// then the plain binary is there for every later call.
async function ensureZig(): Promise<string | null> {
  const z = zigBin();
  if (z) return z;
  const tar = path.join(repoRoot(), "toolchain", "zig.tar.xz");
  if (!fs.existsSync(tar)) return null;
  await new Promise<void>((res, rej) =>
    execFile("tar", ["xf", tar, "-C", path.join(repoRoot(), "toolchain")], (e) => (e ? rej(e) : res()))
  );
  return zigBin();
}

export type BinaryResult = {
  url: string;
  name: string;
  size: number;
  kind: "file"; // UI asset type — the generic file/download card renders it
  ms: number;
} | null;

export async function produceBinary(
  act: { action: string; name?: string; lang?: string; files: { name: string; content: string }[] }
): Promise<BinaryResult> {
  const t0 = Date.now();
  try {
    const wantDll = act.action === "dll";
    const cpp =
      act.lang === "cpp" || act.files.some((f) => /\.(cpp|cc|cxx|hpp)$/i.test(f.name));
    const srcs = act.files.filter((f) => SAFE_STORE.test(f.name) && SRC_RE.test(f.name));
    if (!srcs.length) return null;
    const base = (SAFE_STORE.test(act.name || "") ? (act.name as string) : "")
      .replace(/\.(exe|dll)$/i, "")
      .slice(0, 60);
    const outName = (base || "xr-code-app") + (wantDll ? ".dll" : ".exe");
    const zig = await ensureZig();
    if (!zig) {
      console.error("[binary-factory] zig toolchain unavailable — source zip fallback");
      return null;
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xrbuild-"));
    try {
      for (const f of srcs) fs.writeFileSync(path.join(dir, f.name), f.content, "utf8");
      const out = path.join(dir, outName);
      const args = [
        ...(cpp ? ["c++"] : ["cc"]),
        "-target",
        "x86_64-windows-gnu",
        "-O2",
        "-s", // strip — the default binary carries debug bloat
        ...(wantDll ? ["-shared"] : []),
        "-o",
        out,
        ...srcs.map((f) => f.name),
      ];
      const { code, err } = await new Promise<{ code: number; err: string }>((res) =>
        execFile(zig, args, { cwd: dir, timeout: 120000, maxBuffer: 8 * 1024 * 1024 }, (e, _so, se) =>
          res({ code: e ? ((e as { code?: number }).code ?? 1) : 0, err: String(se || "") })
        )
      );
      if (code !== 0 || !fs.existsSync(out)) {
        console.error("[binary-factory] compile failed:", err.slice(-400).replace(/\s+/g, " "));
        return null;
      }
      const bin = fs.readFileSync(out);
      const url = await saveAssetBytes(bin, "application/octet-stream", outName);
      return {
        url,
        name: outName,
        size: bin.length,
        kind: "file",
        ms: Date.now() - t0,
      };
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch (e) {
    console.error("[binary-factory] failed:", String((e as Error)?.message || e).slice(0, 200));
    return null;
  }
}

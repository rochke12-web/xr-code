import fs from "fs";
import path from "path";

// Stable asset dir OUTSIDE .next — survives rebuilds.
// Hosted standalone build: cwd is .next/standalone → ../../db/assets.
// Local `next dev`: cwd is the project root → ./db/assets.
// XR_ASSET_DIR always wins when set.
export function assetDir(): string {
  if (process.env.XR_ASSET_DIR) return process.env.XR_ASSET_DIR;
  const cwd = process.cwd();
  // hosted standalone CHDIRS into .next/standalone at boot — assets must
  // survive rebuilds, so always resolve to the project-root db/ from in there
  if (cwd.includes(`${path.sep}.next`)) {
    const up = path.resolve(cwd, "../../db/assets");
    if (fs.existsSync(path.dirname(up))) return up;
  }
  const local = path.resolve(cwd, "db/assets");
  if (fs.existsSync(local)) return local;
  return path.resolve(cwd, "../../db/assets");
}

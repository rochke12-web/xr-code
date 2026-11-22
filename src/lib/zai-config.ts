// ZAI SDK bootstrap for Vercel.
//
// ROOT CAUSE (found 2026-11-22): z-ai-web-dev-sdk authenticates by reading a
// `.z-ai-config` FILE from process.cwd(), $HOME, or /etc. The sandbox has it
// at /etc; Vercel lambdas have NONE — so every ZAI.create() there threw
// "Configuration file not found", every gateway paint/enhance lane failed
// instantly, and all user output silently came from the blurry pollinations
// tier ("no quality"). Fix: the config ships as a base64 env var
// (ZAI_CONFIG_B64), is materialized into /tmp (the only writable dir on a
// lambda), and ZAI.create() runs with cwd pointed there for the duration.
import { existsSync, writeFileSync } from "fs";
import ZAI from "z-ai-web-dev-sdk";

let checked = false;
let materialized = false;

function ensureConfigFile(): boolean {
  if (checked) return materialized;
  checked = true;
  try {
    if (existsSync("/tmp/.z-ai-config")) { materialized = true; return true; }
    const b64 = process.env.ZAI_CONFIG_B64;
    if (!b64) return false;
    writeFileSync("/tmp/.z-ai-config", Buffer.from(b64, "base64"));
    materialized = existsSync("/tmp/.z-ai-config");
    return materialized;
  } catch {
    return false;
  }
}

/** Diagnostic state for the probe endpoint — no secret material, just booleans. */
export function zaiConfigState(): { envVar: boolean; file: boolean } {
  return { envVar: !!process.env.ZAI_CONFIG_B64, file: ensureConfigFile() };
}

/**
 * ZAI.create() that works on Vercel: materializes the config from
 * ZAI_CONFIG_B64 into /tmp (writable) and chdir's there just for the call —
 * the SDK only reads the file once, at create(). Outside Vercel (sandbox,
 * local) nothing changes: the plain create() path is used untouched.
 */
export async function createZai(): Promise<ReturnType<typeof ZAI.create>> {
  const hasFile = ensureConfigFile();
  if (!hasFile) return ZAI.create(); // sandbox/local: config already in /etc or $HOME
  const prev = process.cwd();
  try {
    process.chdir("/tmp");
    return await ZAI.create();
  } finally {
    try { process.chdir(prev); } catch { /* keep /tmp */ }
  }
}

// Server-only secret fallbacks — committed so the hosted brain gets the Discord
// gate credentials even when the platform snapshot skips gitignored .env files.
// These are imported ONLY by server-side route handlers (xrauth / xrverify /
// api routes); nothing here ever reaches the browser bundle.
// Owner note: rotate DISCORD_CLIENT_SECRET in the Discord developer portal
// after setup, then update both .env and this file.
export const XR_SECRETS = {
  DISCORD_CLIENT_ID: "1569300109790023772",
  DISCORD_CLIENT_SECRET: "Icbujy0zkI5srzBjYBVL7zvSTAF4Qqi_",
  XR_AUTH_SECRET: "0bb201eba83d12682c84c98e326eb3288dcbd6ff880293764c7084231413937f",
  // payload cipher key — build_private.py parses this from here so build and
  // runtime share ONE source; the key never reaches the browser bundle (the
  // shell decrypts server-side via /api/shell)
  XR_PAYLOAD_KEY: "f3dc49d6997455e5d6f1f57d3f1d3f02",
  DISCORD_INVITE: "https://discord.gg/YPqmsrMRr5",
  // hosted OAuth redirect — must match the Discord developer portal exactly
  DISCORD_REDIRECT_ORIGIN: "https://xr-code.space-z.ai",
  // XR-Auth role id — optional env-style pin. Usually linked at runtime by the
  // server owner (Settings → Discord → paste Role ID); set it here to skip that.
  DISCORD_ROLE_ID: "",
  // Prime Gateway (owner's personal AI gateway, Anthropic-style /v1/messages).
  // Server-side only — this file is never imported by client components.
  PRIME_API_BASE: "https://r1de49ege2k1-d.space-z.ai",
  PRIME_API_KEY: "sk-gw-2d2877685ca7eadff273f709a82781f0042556ead44b7d8a",
};

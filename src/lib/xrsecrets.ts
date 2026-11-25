// Server-only secret fallbacks — imported ONLY by server-side route handlers;
// nothing here ever reaches the browser bundle. Login is Google (Firebase)
// only — there are no Discord credentials anywhere in this app anymore.
// Owner note: set XR_AUTH_SECRET / PRIME_API_KEY as Vercel environment
// variables (they win over these fallbacks) and rotate the old committed
// values — see download/ROTATE-CREDENTIALS.md.
export const XR_SECRETS = {
  // vault cipher + session integrity — prefer the XR_AUTH_SECRET env var
  XR_AUTH_SECRET: "0bb201eba83d12682c84c98e326eb3288dcbd6ff880293764c7084231413937f",
  // payload cipher key — build_private.py parses this from here so build and
  // runtime share ONE source; the key never reaches the browser bundle (the
  // shell decrypts server-side via /api/shell)
  XR_PAYLOAD_KEY: "f3dc49d6997455e5d6f1f57d3f1d3f02",
  // Prime Gateway (owner's personal AI gateway, Anthropic-style /v1/messages).
  // Server-side only — this file is never imported by client components.
  PRIME_API_BASE: "https://r1de49ege2k1-d.space-z.ai",
  PRIME_API_KEY: "sk-gw-2d2877685ca7eadff273f709a82781f0042556ead44b7d8a",
  // OpenRouter — every model on one OpenAI-compatible endpoint (openrouter.ai).
  // Set OPENROUTER_API_KEY as a Vercel env var (it wins over this fallback);
  // empty fallback = the OR lanes skip in ms and the existing chains answer.
  OPENROUTER_API_KEY: "",
};

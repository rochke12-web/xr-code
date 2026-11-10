// Server-only secret fallbacks — committed so the hosted brain gets the Discord
// gate credentials even when the platform snapshot skips gitignored .env files.
// These are imported ONLY by server-side route handlers (xrauth / xrverify /
// api routes); nothing here ever reaches the browser bundle.
// Owner note: rotate DISCORD_CLIENT_SECRET in the Discord developer portal
// after setup, then update both .env and this file.
export const XR_SECRETS = {
  DISCORD_CLIENT_SECRET: "Icbujy0zkI5srzBjYBVL7zvSTAF4Qqi_",
  XR_AUTH_SECRET: "0bb201eba83d12682c84c98e326eb3288dcbd6ff880293764c7084231413937f",
  DISCORD_INVITE: "https://discord.gg/YPqmsrMRr5",
};

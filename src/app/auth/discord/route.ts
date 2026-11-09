// Discord verification entry point — bounces the visitor to the Discord
// consent screen. Same flow the lock-screen button builds inline; redirect_uri
// follows the current origin so localhost:3000 and the live preview domain
// both work (each must be registered in the Discord app's OAuth2 redirects).
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const cid = process.env.DISCORD_CLIENT_ID || "1569300109790023772";
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", cid);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", new URL(req.url).origin + "/auth/discord/callback");
  url.searchParams.set("scope", "identify guilds guilds.join guilds.members.read");
  return NextResponse.redirect(url.toString());
}

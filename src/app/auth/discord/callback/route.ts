// Discord OAuth callback — the code never touches the browser.
// Exchange -> identify -> membership check in the owner's server ->
// verified member ? mint cookie : bounce back with an error code.
import { NextResponse } from "next/server";
import { mintToken, authCookie } from "@/lib/xrauth";
import { exchangeAndVerify } from "@/lib/xrverify";

function fail(req: Request, code: string) {
  return NextResponse.redirect(new URL("/?dserr=" + code, req.url));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") || "";
  if (!code) return fail(req, "setup");
  const v = await exchangeAndVerify(code, url.origin + "/auth/discord/callback");
  if (!v.ok) return fail(req, v.error);
  const res = NextResponse.redirect(new URL("/?dsok=1", req.url));
  res.headers.set("Set-Cookie", authCookie(mintToken(v.uid)));
  return res;
}

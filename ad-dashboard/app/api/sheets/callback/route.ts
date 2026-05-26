import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { writeTokens } from "@/lib/customStore";

const APP_URL  = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const REDIRECT = `${APP_URL}/api/sheets/callback`;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${APP_URL}/new-ad?sheets_error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${APP_URL}/new-ad?sheets_error=no_code`);
  }

  const clientId     = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const oauth2       = new google.auth.OAuth2(clientId, clientSecret, REDIRECT);

  try {
    const { tokens } = await oauth2.getToken(code);
    writeTokens({
      access_token:  tokens.access_token!,
      refresh_token: tokens.refresh_token!,
      expiry_date:   tokens.expiry_date!,
      scope:         tokens.scope!,
    });
    return NextResponse.redirect(`${APP_URL}/new-ad?sheets_connected=1`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(`${APP_URL}/new-ad?sheets_error=${encodeURIComponent(msg)}`);
  }
}

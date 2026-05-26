import { NextResponse } from "next/server";
import { google } from "googleapis";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const REDIRECT = `${APP_URL}/api/sheets/callback`;
const SCOPES   = ["https://www.googleapis.com/auth/spreadsheets.readonly"];

export async function GET() {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json({
      error:    "Google OAuth not configured",
      setup:    true,
      instructions: [
        "1. Go to https://console.cloud.google.com",
        "2. Create a new project (or select existing)",
        "3. Enable the Google Sheets API",
        "4. Go to APIs & Services → Credentials",
        "5. Create OAuth 2.0 Client ID (Web application)",
        `6. Add Authorized redirect URI: ${REDIRECT}`,
        "7. Copy Client ID and Client Secret",
        "8. Add to .env.local: GOOGLE_CLIENT_ID=... and GOOGLE_CLIENT_SECRET=...",
        `9. Also add: NEXT_PUBLIC_APP_URL=${APP_URL}`,
      ],
    }, { status: 503 });
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT);
  const url    = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt:      "consent",
    scope:       SCOPES,
  });

  return NextResponse.redirect(url);
}

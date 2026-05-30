import { NextResponse } from "next/server";

/**
 * Apple Universal Links manifest.
 *
 * iOS fetches this from `/.well-known/apple-app-site-association` (no
 * file extension, MIME `application/json`) when the user installs the
 * app. With this in place, taps on `https://piercing.studio/...`
 * links open the native app instead of Safari.
 *
 * Gated on `APPLE_TEAM_ID` so misconfigured deploys (no app yet) 404
 * cleanly instead of returning a JSON file with a placeholder team
 * id, which would actively break Universal Links.
 *
 * See docs/19-mobile-app.md and mobile/README.md for setup.
 */
export const dynamic = "force-static";

export async function GET() {
  const teamId = process.env.APPLE_TEAM_ID;
  if (!teamId) {
    return new NextResponse("Not configured", { status: 404 });
  }
  const bundleId = process.env.APPLE_BUNDLE_ID ?? "studio.pierc.app";

  return NextResponse.json(
    {
      applinks: {
        apps: [],
        details: [
          {
            appID: `${teamId}.${bundleId}`,
            paths: ["*"],
          },
        ],
      },
    },
    {
      headers: {
        // Apple requires application/json; some validators reject
        // text/plain with charset=utf-8.
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}

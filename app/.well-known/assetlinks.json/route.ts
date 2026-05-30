import { NextResponse } from "next/server";

/**
 * Android App Links manifest.
 *
 * Android fetches this from `/.well-known/assetlinks.json` to verify
 * that this domain is associated with the native app's signing
 * certificate. Once verified, taps on `https://piercing.studio/...`
 * links open the native app instead of Chrome.
 *
 * Gated on `ANDROID_SHA256_FINGERPRINT` so misconfigured deploys 404
 * cleanly. The fingerprint is the SHA-256 of the keystore your
 * Android build is signed with (EAS Build can output it via
 * `eas credentials`).
 *
 * See docs/19-mobile-app.md and mobile/README.md for setup.
 */
export const dynamic = "force-static";

export async function GET() {
  const fingerprint = process.env.ANDROID_SHA256_FINGERPRINT;
  if (!fingerprint) {
    return new NextResponse("Not configured", { status: 404 });
  }
  const packageName = process.env.ANDROID_PACKAGE_NAME ?? "studio.pierc.app";

  // Android lets you list multiple fingerprints (handy when EAS
  // upload-key + Play Store signing-key differ). Allow the env var
  // to be a single value or comma-separated.
  const fingerprints = fingerprint
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: packageName,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}

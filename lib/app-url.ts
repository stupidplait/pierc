// Single source of truth for the deployment's absolute origin.
//
// Used by metadataBase (root layout), the sitemap, robots, and the /about
// JSON-LD so the canonical / OpenGraph / Twitter / sitemap URLs can never drift
// apart. Resolved once at module load.
//
// Resolution order:
//   1. APP_URL                         — explicit override (prod + dev)
//   2. VERCEL_PROJECT_PRODUCTION_URL   — Vercel injects this on every deploy, so
//                                        production is correct with zero config
//   3. http://localhost:3000           — local-dev fallback
//
// IMPORTANT: this uses `||`, not `??`. `.env.example` ships `APP_URL=""` for dev,
// and an empty string is NOT nullish — with `??` it would survive and make
// `new URL("")` throw at module eval (a site-wide crash). `||` correctly treats
// "" as "unset".
function resolveAppUrl(): string {
  const explicit = process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}

export const APP_URL = resolveAppUrl();

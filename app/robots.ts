import type { MetadataRoute } from "next";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

/**
 * Public robots.txt. Next.js serves this at `/robots.txt`.
 *
 * Allow-list public surfaces; disallow:
 *   /admin, /account, /auth — auth-walled, no value indexing
 *   /api                    — internal route handlers
 *   /book/success           — per-booking landing, no value indexing
 *   /review                 — tokenized customer-specific URLs
 *
 * See docs/17-seo.md.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/account",
          "/account/",
          "/auth",
          "/auth/",
          "/api",
          "/api/",
          "/book/success",
          "/review",
          "/review/",
        ],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}

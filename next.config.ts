import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  // Server-side GLB optimization (lib/admin/glb-pipeline.ts) pulls in native /
  // WASM deps. Opt them out of Server Component bundling so they load via native
  // `require` (sharp is auto-externalized by Next, but we list it for intent).
  serverExternalPackages: ["sharp", "meshoptimizer"],

  // Throttle static-generation parallelism + add retries so the build is
  // robust against Neon free-tier connection bursts. With the default, many
  // pages prerender at once and all open Prisma pools, overwhelming the pooler
  // — half then fail with P1001 "Can't reach database server".
  // staticGenerationMaxConcurrency caps the simultaneous page renders directly
  // (rather than throttling the whole build incl. SWC/TS compilation the way
  // `cpus` did); three retries absorbs any transient burst.
  experimental: {
    staticGenerationMaxConcurrency: 2,
    staticGenerationRetryCount: 3,
    viewTransition: true,
    // Tree-shake large barrels that aren't in Next's built-in default list
    // (lucide-react already is). framer-motion ships the full feature set on a
    // barrel import; @react-three/drei is a very large barrel used only in the
    // code-split WebGL chunks — both benefit from per-export rewriting.
    optimizePackageImports: [
      "framer-motion",
      "@react-three/drei",
      "@react-three/postprocessing",
    ],
  },

  // Allow next/image to optimize photos hosted on Vercel Blob (the manual
  // upload + parametric jewelry pipeline) and the legacy Tripo3D CDN.
  // Without remotePatterns Next.js refuses to optimize remote URLs and we
  // were forced to use `unoptimized` everywhere — losing webp/avif,
  // responsive sizing, and CDN caching.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.blob.vercel-storage.com",
        pathname: "/**",
      },
      // Tripo3D CDN — short-lived URLs but needed during the rehost step.
      {
        protocol: "https",
        hostname: "tripo3d.ai",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.tripo3d.ai",
        pathname: "/**",
      },
    ],
  },

  async redirects() {
    return [
      // /contact merged into /about (single page with a #contact section).
      {
        source: "/contact",
        destination: "/about#contact",
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      {
        // Apply baseline security headers to every route.
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Security headers
//
// Enforced headers are the well-understood, non-breaking set. The CSP ships in
// Report-Only mode so violations are observable (browser console + the
// /api/csp-report sink) WITHOUT breaking production — the app currently relies on
// Next's inline bootstrap + an inline theme script, so a strict script-src
// needs a nonce migration before we can enforce. To enforce later: add a nonce
// in proxy.ts, drop 'unsafe-inline' from script-src, and rename the header key
// to "Content-Security-Policy".
//
// Permissions-Policy intentionally allows camera=(self): the photo "lite mode"
// try-on (components/lite/SelfieCanvas) calls getUserMedia.
// ─────────────────────────────────────────────────────────────────────────────
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  // Next.js + Vercel analytics inject inline/external scripts.
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.blob.vercel-storage.com https://*.public.blob.vercel-storage.com",
  "font-src 'self' data:",
  // Vercel blob (GLB/photos), analytics + speed insights beacons.
  "connect-src 'self' https://*.blob.vercel-storage.com https://*.public.blob.vercel-storage.com https://vitals.vercel-insights.com https://va.vercel-scripts.com",
  // mediapipe wasm / face-landmarker run in workers and decode blobs.
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  // Aggregate violations at /api/csp-report (report-to = modern Reporting API,
  // report-uri = legacy fallback) instead of only the visitor's console.
  "report-uri /api/csp-report",
  "report-to csp",
].join("; ");

// Enforced now: the inline-INDEPENDENT directives that add real protection
// without needing a nonce. None of these fall back to default-src in a way that
// touches script/style, so they ship as a real (non-Report-Only) policy while the
// full script-src nonce migration described above is still pending.
const CSP_ENFORCED = [
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), browsing-topics=()",
  },
  // Named reporting endpoint the CSP `report-to` group resolves to.
  { key: "Reporting-Endpoints", value: 'csp="/api/csp-report"' },
  { key: "Content-Security-Policy", value: CSP_ENFORCED },
  { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
];

export default nextConfig;

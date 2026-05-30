import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  // Throttle static-generation parallelism + add retries so the build is
  // robust against Neon free-tier connection bursts. With the default
  // (one worker per CPU minus one), 11 workers all open Prisma pools and
  // overwhelm the pooler — half the pages then fail with P1001
  // "Can't reach database server". Two workers + three retries keeps
  // the build deterministic without meaningfully extending wall time.
  experimental: {
    cpus: 2,
    staticGenerationRetryCount: 3,
    viewTransition: true,
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
};

export default nextConfig;

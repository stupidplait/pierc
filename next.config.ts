import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

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

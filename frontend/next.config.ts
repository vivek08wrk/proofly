import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        // Cloudflare R2 public bucket CDN domain
        // This allows next/image to optimize and serve R2-hosted images
        protocol: "https",
        hostname: "*.r2.dev",
        port: "",
        pathname: "/**",
      },
    ],
  },

  // Disable X-Powered-By header for minor security hardening
  poweredByHeader: false,

  // Enable React strict mode for catching potential issues early
  reactStrictMode: true,
};

export default nextConfig;
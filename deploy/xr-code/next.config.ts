import type { NextConfig } from "next";

// XR-Code on Vercel: static UI + proxied brain.
// The AI engine credential file only exists inside the home sandbox, so every
// /api/* call is transparently proxied to the always-on xr-code.space-z.ai brain.
// No secrets, keys or engine code ship to Vercel..
const BRAIN = "https://xr-code.space-z.ai";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/api/:path*", destination: `${BRAIN}/api/:path*` },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;

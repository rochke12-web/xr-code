import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Deploy-package slimming — root cause of the platform "Failed" deploys:
  // chat/asset/xrstore routes do fs calls whose static prefix is the project
  // root (dynamic subdir names, dynamic asset ids), so the file tracer swept
  // the WHOLE repo into .next/standalone (.git pack, demo MP4s, scripts, user
  // uploads…) → package grew past the deploy size budget and deploys failed.
  // Pin the trace root and strip everything the production server never reads.
  outputFileTracingRoot: __dirname,
  outputFileTracingExcludes: {
    "*": [
      "./.git/**/*",
      "./.secrets/**/*",
      "./.zscripts/**/*",
      "./upload/**/*",
      "./download/**/*",
      "./scripts/**/*",
      "./video-editor/**/*",
      "./skills/**/*",
      "./tool-results/**/*",
      "./deploy/**/*",
      "./docs/**/*",
      "./examples/**/*",
      "./tests/**/*",
      "./mini-services/**/*",
      // runtime user data is created on the runner, never baked into the package
      "./db/assets/**/*",
      "./db/chats/**/*",
      "./db/usage/**/*",
      "./db/keys/**/*",
      "./db/videoedits/**/*",
      "./db/videojobs/**/*",
      // build-time-only heavyweights: schema engines (CLI) + type checker + foreign-arch sharp
      "./node_modules/@prisma/engines/**/*",
      "./node_modules/typescript/**/*",
      "./node_modules/@img/sharp-libvips-linuxmusl-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-arm64-gnu/**/*",
      "./node_modules/@img/sharp-libvips-linux-arm64-musl/**/*",
      "./node_modules/@img/sharp-linuxmusl-x64/**/*",
      "./node_modules/@img/sharp-linux-arm64-gnu/**/*",
      "./node_modules/@img/sharp-linux-arm64-musl/**/*",
    ],
  },
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;

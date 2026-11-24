import type { NextConfig } from "next";
import WebpackObfuscator from "webpack-obfuscator";

const nextConfig: NextConfig = {
  output: "standalone",
  // No source maps in production — client code stays unreadable
  productionBrowserSourceMaps: false,
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
      // the zig toolchain stays in the repo itself (extracted on first use from
      // the committed tarball) — never sweep 250MB of compiler into the package
      "./toolchain/**/*",
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
  // "Encrypt" the shipped client code: every browser bundle gets run through
  // javascript-obfuscator (string array + unicode escapes + self-defending).
  // Only client bundles in production — server code never ships anyway, and
  // we keep this OFF in dev so hot reload stays instant.
  webpack: (config, { isServer, dev }) => {
    if (!dev && !isServer && !config.name?.includes?.("edge")) {
      config.plugins.push(
        new WebpackObfuscator(
          {
            // medium-strength: real protection without wrecking 144fps perf
            compact: true,
            stringArray: true,
            stringArrayEncoding: ["base64"],
            stringArrayRotate: true,
            stringArrayShuffle: true,
            stringArrayThreshold: 0.8,
            stringArrayCallsTransform: true,
            stringArrayIndexShift: true,
            stringArrayWrappersCount: 2,
            stringArrayWrappersType: "function",
            unicodeEscapeSequence: true,
            deadCodeInjection: false, // keeps bundle size sane
            controlFlowFlattening: false, // keeps runtime fast
            selfDefending: true,
            debugProtection: false,
            disableConsoleOutput: false,
            renameGlobals: false,
            splitStrings: true,
            splitStringsChunkLength: 8,
            transformObjectKeys: true,
            numbersToExpressions: true,
            simplify: true,
          },
          // skip node_modules internals that break under selfDefending
          ["!**/node_modules/**"],
        ),
      );
    }
    return config;
  },
};

export default nextConfig;

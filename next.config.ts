import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@remotion/bundler',
    '@remotion/renderer',
    'esbuild',
    'msedge-tts',
    'music-metadata',
    'sucrase'
  ],
};

export default nextConfig;

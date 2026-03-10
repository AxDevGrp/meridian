import type { NextConfig } from "next";
import CopyWebpackPlugin from "copy-webpack-plugin";

const nextConfig: NextConfig = {
  // Add empty turbopack config to silence the warning
  // Turbopack is enabled by default in Next.js 16
  turbopack: {},

  webpack: (config, { isServer }) => {
    // Cesium configuration
    config.resolve = config.resolve || {};
    config.resolve.fallback = config.resolve.fallback || {};

    // Cesium requires these node polyfills for browser
    if (!isServer) {
      config.resolve.fallback.fs = false;
      config.resolve.fallback.http = false;
      config.resolve.fallback.https = false;
      config.resolve.fallback.url = false;
      config.resolve.fallback.zlib = false;
    }

    // Copy Cesium static files to public directory
    config.plugins.push(
      new CopyWebpackPlugin({
        patterns: [
          {
            from: "node_modules/cesium/Build/Cesium/Workers",
            to: "cesium/Workers",
          },
          {
            from: "node_modules/cesium/Build/Cesium/ThirdParty",
            to: "cesium/ThirdParty",
          },
          {
            from: "node_modules/cesium/Build/Cesium/Assets",
            to: "cesium/Assets",
          },
          {
            from: "node_modules/cesium/Build/Cesium/Widgets",
            to: "cesium/Widgets",
          },
        ],
      })
    );

    return config;
  },
};

export default nextConfig;

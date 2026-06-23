import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Enable standalone build for easier deployment
  productionBrowserSourceMaps: false,
  // Turbopack enabled by default in Next.js 16
  // Empty config to silence webpack/turbopack compatibility warning
  turbopack: {},
  experimental: {
    cssChunking: "strict", // Only load CSS chunks that are actually used on the rendered page
    optimizeCss: true, // Optimize CSS output
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Reduce aggressive CSS splitting to minimize preload warnings
      config.optimization = config.optimization || {};
      config.optimization.splitChunks = config.optimization.splitChunks || {};
      const cacheGroups = config.optimization.splitChunks.cacheGroups || {};
      
      // Merge CSS chunks more aggressively to reduce unused preloads
      if (typeof cacheGroups === 'object' && cacheGroups !== null) {
        (cacheGroups as Record<string, unknown>).styles = {
          name: "styles",
          test: /\.(css|scss|sass)$/,
          chunks: "all",
          enforce: true,
          priority: 10,
        };
      }
    }
    return config;
  },
  async rewrites() {
    // API routes handled by custom proxy route handler (src/app/api/[...path]/route.ts)
    // This avoids header forwarding issues in IIS environment
    const backend = process.env.BACKEND_INTERNAL_URL || "http://localhost:6000";
    return {
      beforeFiles: [
        // Short link: 6-char alphanumeric code → resolve via server component
        {
          source: "/:code([A-Za-z0-9]{6})",
          destination: "/survey/resolve?code=:code",
        },
      ],
      afterFiles: [
        // Proxy uploads to backend — must be afterFiles so Next.js standalone server.js
        // handles the proxy at runtime (beforeFiles is ignored in IIS/standalone mode)
        {
          source: "/uploads/:path*",
          destination: `${backend}/uploads/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;

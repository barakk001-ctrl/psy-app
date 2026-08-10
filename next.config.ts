import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    typedRoutes: false,
    serverActions: {
      // File attachments upload through a server action
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // next/image (the login page's photo): modern formats first
  images: { formats: ["image/avif", "image/webp"] },
  experimental: {
    typedRoutes: false,
    serverActions: {
      // File attachments upload through a server action
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;

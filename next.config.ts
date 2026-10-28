import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  // No "X-Powered-By: Next.js" — nothing to gain from advertising the stack.
  poweredByHeader: false,
  // next/image (the login page's photo): modern formats first
  images: { formats: ["image/avif", "image/webp"] },
  // www.mirpaa.app → mirpaa.app (Railway serves both; the redirect is ours).
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.mirpaa.app" }],
        destination: "https://mirpaa.app/:path*",
        permanent: true,
      },
    ];
  },
  // HSTS, no framing, nosniff, referrer, permissions, and a report-only CSP —
  // the policy and what it allows (and why) is in src/lib/security-headers.ts.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({ dev: process.env.NODE_ENV === "development" }),
      },
    ];
  },
  experimental: {
    typedRoutes: false,
    serverActions: {
      // File attachments and client documents upload through server actions,
      // one file per call (client documents: up to 15MB, MAX_DOCUMENT_BYTES)
      bodySizeLimit: "16mb",
    },
    // The middleware runs on page routes, so server-action POSTs pass through
    // it, and Next buffers only the first 10MB of a body there by default —
    // a bigger upload would arrive cut off. Keep this ≥ bodySizeLimit.
    middlewareClientMaxBodySize: "16mb",
  },
};

export default nextConfig;

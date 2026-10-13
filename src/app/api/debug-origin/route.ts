import type { NextRequest } from "next/server";
import { originFromHeaders, trustedOrigins } from "@/lib/request-origin";

// TEMPORARY diagnostic (remove after checking the custom domain): which
// host headers reach the app behind Railway. No secrets, no cookies.
export const dynamic = "force-dynamic";
export function GET(req: NextRequest) {
  const pick = [...req.headers.keys()].filter((k) =>
    /^(host|x-forwarded-|forwarded|x-real-ip|x-railway|x-original|x-envoy-original)/.test(k),
  );
  const headers = Object.fromEntries(
    pick.filter((k) => k !== "x-forwarded-for" && k !== "x-real-ip").map((k) => [k, req.headers.get(k)]),
  );
  return Response.json({
    url: req.url,
    headers,
    origin: originFromHeaders(req.headers),
    trusted: trustedOrigins(),
  });
}

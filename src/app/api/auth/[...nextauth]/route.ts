import type { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { withPublicOrigin } from "@/lib/request-origin";

// Auth.js builds callback URLs (e.g. Google's redirect_uri) from req.url,
// which behind Railway's proxy is localhost — use the public address instead.
export const GET = (req: NextRequest) => handlers.GET(withPublicOrigin(req));
export const POST = (req: NextRequest) => handlers.POST(withPublicOrigin(req));

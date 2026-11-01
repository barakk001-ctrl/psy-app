import { dbAll } from "@/lib/db";
import { checkHealth } from "@/lib/health";

// Public liveness check for uptime monitors and Railway's deploy healthcheck:
// 200 {"ok":true,"db":"ok"} when the app answers and Postgres responds to
// `SELECT 1`; 503 {"ok":false,"db":"error"} otherwise. No auth (API routes are
// outside the middleware), no user data, one trivial query.

export const dynamic = "force-dynamic";

export async function GET() {
  const { status, body } = await checkHealth(() => dbAll.$queryRaw`SELECT 1`);
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function HEAD() {
  const { status } = await checkHealth(() => dbAll.$queryRaw`SELECT 1`);
  return new Response(null, { status, headers: { "Cache-Control": "no-store" } });
}

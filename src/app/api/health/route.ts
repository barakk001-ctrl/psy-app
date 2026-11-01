import crypto from "node:crypto";
import { dbAll } from "@/lib/db";
import { checkHealth } from "@/lib/health";

// Public liveness check for uptime monitors and Railway's deploy healthcheck:
// 200 {"ok":true,"db":"ok"} when the app answers and Postgres responds to
// `SELECT 1`; 503 {"ok":false,"db":"error"} otherwise. No auth (API routes are
// outside the middleware), no user data, one trivial query.

export const dynamic = "force-dynamic";

// TEMPORARY (removed in the next commit): measures how Railway's edge treats
// forwarding headers. Booleans and counts only, never an address.
let probeLines = 0;
function logIpProbe(req: Request) {
  const expected = req.headers.get("x-ip-probe");
  if (!expected || probeLines >= 40) return;
  probeLines += 1;
  const sha = (v: string) => crypto.createHash("sha256").update(v.trim()).digest("hex");
  const real = req.headers.get("x-real-ip");
  const hops = (req.headers.get("x-forwarded-for") ?? "").split(",").map((h) => h.trim()).filter(Boolean);
  const isSpoof = (v: string | null | undefined) => !!v && v.trim().startsWith("203.0.113.");
  const isClient = (v: string | null | undefined) => !!v && sha(v) === expected;
  console.log(
    `[ip-probe] real=${real ? "present" : "absent"} realIsClient=${isClient(real)} realIsSpoof=${isSpoof(real)}` +
      ` hops=${hops.length} firstIsClient=${isClient(hops[0])} firstIsSpoof=${isSpoof(hops[0])}` +
      ` lastIsClient=${isClient(hops[hops.length - 1])} lastIsSpoof=${isSpoof(hops[hops.length - 1])}` +
      ` anySpoof=${hops.some(isSpoof)}`,
  );
}

export async function GET(req: Request) {
  logIpProbe(req);
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

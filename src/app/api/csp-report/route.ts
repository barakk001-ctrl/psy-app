import { createLogBudget, cspLogLine, parseCspReports } from "@/lib/csp-report";

// Receives the browser's Content-Security-Policy-Report-Only violation reports
// (src/lib/security-headers.ts) and logs one sanitised line each, so
// `railway logs --filter "[csp]"` shows what a stricter policy would block.
// Public by design (browsers send reports without cookies); it stores nothing.

export const dynamic = "force-dynamic";

const MAX_BODY = 16 * 1024;
const allowLog = createLogBudget(60, 10 * 60 * 1000);

export async function POST(req: Request) {
  try {
    const text = await req.text();
    if (text.length <= MAX_BODY) {
      for (const v of parseCspReports(JSON.parse(text))) {
        if (!allowLog()) break;
        console.warn(cspLogLine(v));
      }
    }
  } catch {
    // Not JSON / not a report — ignore.
  }
  return new Response(null, { status: 204 });
}

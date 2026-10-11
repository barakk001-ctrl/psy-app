// Runs once when the server starts (Next.js instrumentation hook). Railway
// keeps the app running as one long-lived Node process, so the app schedules
// its own housekeeping here rather than relying on an outside cron.
export async function register() {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  // Not in the edge middleware. Written as a block (the form Next.js documents)
  // rather than an early return, so the edge bundle drops the import entirely —
  // maintenance pulls in node:crypto (support-request emails), which the edge
  // build cannot compile.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startMaintenance } = await import("./server/maintenance");
    startMaintenance();
  }
}

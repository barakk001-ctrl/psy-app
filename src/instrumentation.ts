// Runs once when the server starts (Next.js instrumentation hook). Railway
// keeps the app running as one long-lived Node process, so the app schedules
// its own housekeeping here rather than relying on an outside cron.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return; // not in the edge middleware
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { startMaintenance } = await import("./server/maintenance");
  startMaintenance();
}

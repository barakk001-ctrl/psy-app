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
    // Error tracking — only when SENTRY_DSN is set (src/lib/sentry-options.ts).
    if (process.env.SENTRY_DSN) {
      const Sentry = await import("@sentry/nextjs");
      const { serverSentryOptions } = await import("./lib/sentry-options");
      Sentry.init({
        ...serverSentryOptions(process.env.SENTRY_DSN),
        // Never read incoming request bodies (a note being saved, a client's
        // details); the scrubber drops them too — this keeps them out of memory.
        integrations: [Sentry.httpIntegration({ maxIncomingRequestBodySize: "none" })],
      });
    }
    const { startMaintenance } = await import("./server/maintenance");
    startMaintenance();
  }
}

// Errors thrown while rendering pages, route handlers and server actions.
// Inactive without SENTRY_DSN; Node only (the edge middleware isn't reported).
export async function onRequestError(...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>) {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (!process.env.SENTRY_DSN) return;
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureRequestError(...args);
  }
}

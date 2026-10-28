// Runs in the browser before the app starts (Next.js 15.3+). Browser error
// tracking is on only when NEXT_PUBLIC_SENTRY_DSN was set at build time —
// otherwise this whole block is compiled away and Sentry is never downloaded.
// Settings and privacy rules: src/lib/sentry-options.ts, src/lib/sentry-scrub.ts.

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  void Promise.all([import("@sentry/nextjs"), import("@/lib/sentry-options")])
    .then(([Sentry, { clientSentryOptions }]) => Sentry.init(clientSentryOptions(dsn)))
    .catch(() => {
      // Error reporting must never break the app.
    });
}

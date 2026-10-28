// Sends an error caught by an error boundary (error.tsx / global-error.tsx)
// to Sentry — only when NEXT_PUBLIC_SENTRY_DSN was set at build time.
// Without it this is a no-op and @sentry/nextjs is never loaded.
export function reportClientError(error: unknown): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  import("@sentry/nextjs")
    .then((Sentry) => Sentry.captureException(error))
    .catch(() => {});
}

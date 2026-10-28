// Shared Sentry settings for the server (src/instrumentation.ts) and the
// browser (src/instrumentation-client.ts). Sentry is OFF unless a DSN is set:
//   SENTRY_DSN              — server errors (read at runtime)
//   NEXT_PUBLIC_SENTRY_DSN  — browser errors (inlined at build time, so a
//                             change needs a redeploy; Railway does that)
// Use a project in Sentry's EU region (DSN host *.ingest.de.sentry.io) — the
// CSP's connect-src only allows that host. Without a DSN nothing is imported
// in the browser and nothing is initialised on the server.
//
// Privacy: no default PII, no local variables, no session replay, no tracing,
// and every event/breadcrumb passes through src/lib/sentry-scrub.ts.

import type { BrowserOptions, NodeOptions } from "@sentry/nextjs";
import { scrubBreadcrumb, scrubEvent } from "@/lib/sentry-scrub";

type Shared = Pick<
  NodeOptions & BrowserOptions,
  "dsn" | "environment" | "sendDefaultPii" | "beforeSend" | "beforeBreadcrumb" | "beforeSendTransaction" | "maxBreadcrumbs" | "tracesSampleRate"
>;

export function sentryEnvironment(): string {
  return process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV || "production";
}

function shared(dsn: string): Shared {
  return {
    dsn,
    environment: sentryEnvironment(),
    sendDefaultPii: false,
    // No performance tracing: errors only.
    tracesSampleRate: undefined,
    beforeSendTransaction: () => null,
    beforeSend: (event, hint) => scrubEvent(event, hint),
    beforeBreadcrumb: (b) => scrubBreadcrumb(b),
    maxBreadcrumbs: 30,
  };
}

export function serverSentryOptions(dsn: string): NodeOptions {
  return {
    ...shared(dsn),
    includeLocalVariables: false,
  };
}

export function clientSentryOptions(dsn: string): BrowserOptions {
  return {
    ...shared(dsn),
    // No session replay, no feedback widget, no tracing integrations: only
    // the defaults (global error handlers, breadcrumbs, dedupe…).
    integrations: (defaults) => defaults.filter((i) => !/replay|feedback|browsertracing/i.test(i.name)),
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  };
}

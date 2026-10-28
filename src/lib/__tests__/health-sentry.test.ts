import { describe, expect, it } from "vitest";
import type { ErrorEvent } from "@sentry/nextjs";
import { checkHealth } from "@/lib/health";
import { scrubBreadcrumb, scrubEvent, scrubText, scrubUrl } from "@/lib/sentry-scrub";
import { clientSentryOptions, serverSentryOptions } from "@/lib/sentry-options";

describe("checkHealth", () => {
  it("is ok when the DB answers", async () => {
    expect(await checkHealth(async () => 1)).toEqual({ status: 200, body: { ok: true, db: "ok" } });
  });

  it("is 503 without details when the DB fails", async () => {
    const r = await checkHealth(async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.1:5432 password=hunter2");
    });
    expect(r).toEqual({ status: 503, body: { ok: false, db: "error" } });
    expect(JSON.stringify(r)).not.toContain("hunter2");
  });

  it("gives up on a hanging DB", async () => {
    const r = await checkHealth(() => new Promise(() => {}), 20);
    expect(r.status).toBe(503);
  });
});

describe("scrubText", () => {
  it("keeps the first line only (Prisma prints the whole argument after it)", () => {
    const msg = "Invalid `prisma.sessionNote.update()` invocation:\n\n{ data: { content: \"היא סיפרה על…\" } }";
    expect(scrubText(msg)).toBe("Invalid `prisma.sessionNote.update()` invocation:");
  });

  it("masks emails, quoted strings and long numbers", () => {
    expect(scrubText('No client "דנה כהן" for dana@example.com, phone 050-1234567, id 012345678')).toBe(
      'No client "…" for [email], phone [number], id [number]',
    );
  });

  it("skips leading blank lines", () => {
    expect(scrubText("\nInvalid `prisma.client.findMany()` invocation in\n/app/x.js:3:1\n  data")).toBe(
      "Invalid `prisma.client.findMany()` invocation in",
    );
  });

  it("caps the length", () => {
    expect(scrubText("x".repeat(1000))!.length).toBe(300);
  });
});

describe("scrubUrl", () => {
  it("keeps the origin and the page type", () => {
    expect(scrubUrl("https://mirpaa.app/clients/cmabc123/sessions?token=secret")).toBe("https://mirpaa.app/clients/:id/sessions");
    expect(scrubUrl("/request/AbC123tok")).toBe("/request/:id");
  });
});

function sampleEvent(): ErrorEvent {
  return {
    type: undefined,
    message: "line one\nline two with note text",
    user: { id: "u1", email: "keren@example.com", ip_address: "1.2.3.4" },
    server_name: "railway-host",
    extra: { args: { content: "note text" } },
    request: {
      method: "POST",
      url: "https://mirpaa.app/sessions/cmxyz987?tab=note",
      data: "content=secret note",
      cookies: { "authjs.session-token": "abc" },
      headers: { cookie: "x", authorization: "Bearer y" },
      query_string: "tab=note",
    },
    contexts: { runtime: { name: "node" }, response: { status_code: 500 }, state: { note: "x" } },
    transaction: "POST /sessions/cmxyz987",
    exception: {
      values: [
        {
          type: "Error",
          value: "Failed for 'דנה'\nfull dump",
          stacktrace: { frames: [{ filename: "notes.ts", vars: { plaintext: "the note" } }] },
        },
      ],
    },
    breadcrumbs: [
      { category: "console", message: "decrypted: the note" },
      { category: "ui.click", message: "button.save" },
      { category: "fetch", data: { method: "POST", url: "/api/files/abc123?x=1", status_code: 500, body: "x" } },
      { category: "navigation", data: { from: "/clients/a1b2", to: "/clients/c3d4/edit" } },
    ],
  } as unknown as ErrorEvent;
}

describe("scrubEvent", () => {
  const e = scrubEvent(sampleEvent());
  const all = JSON.stringify(e);

  it("drops user, server name, extra and non-technical contexts", () => {
    expect(e.user).toBeUndefined();
    expect(e.server_name).toBeUndefined();
    expect(e.extra).toBeUndefined();
    expect(Object.keys(e.contexts!)).toEqual(["runtime"]);
  });

  it("keeps only method + page type of the request", () => {
    expect(e.request).toEqual({ method: "POST", url: "https://mirpaa.app/sessions/:id" });
    expect(e.transaction).toBe("POST /sessions/:id");
  });

  it("never carries note text, cookies, tokens or names", () => {
    for (const s of ["note text", "secret note", "the note", "authjs", "Bearer", "keren@", "1.2.3.4", "דנה", "full dump", "tab=note"]) {
      expect(all).not.toContain(s);
    }
  });

  it("removes stack-frame variables", () => {
    expect(e.exception!.values![0].stacktrace!.frames![0].vars).toBeUndefined();
    expect(e.exception!.values![0].value).toBe("Failed for '…'");
  });

  it("keeps only navigation/HTTP breadcrumbs, sanitised", () => {
    expect(e.breadcrumbs!.map((b) => b.category)).toEqual(["fetch", "navigation"]);
    expect(e.breadcrumbs![0].data).toEqual({ method: "POST", status_code: 500, url: "/api/files/:id" });
    expect(e.breadcrumbs![1].data).toEqual({ from: "/clients/:id", to: "/clients/:id/edit" });
  });

  it("adds a Prisma error code from the original error", () => {
    const ev = { exception: { values: [{ type: "PrismaClientKnownRequestError", value: "\nInvalid `x` invocation:\nmore" }] } };
    const out = scrubEvent(ev as unknown as ErrorEvent, { originalException: { code: "P1001" } });
    expect(out.exception!.values![0].value).toBe("Invalid `x` invocation: [P1001]");
  });

  it("keeps route patterns in transactions", () => {
    const t = scrubEvent({ ...sampleEvent(), transaction: "GET /clients/[id]" } as unknown as ErrorEvent);
    expect(t.transaction).toBe("GET /clients/[id]");
  });
});

describe("scrubBreadcrumb", () => {
  it("drops console breadcrumbs", () => {
    expect(scrubBreadcrumb({ category: "console", message: "x" })).toBeNull();
  });
});

describe("Sentry options", () => {
  it("never sends default PII or local variables, no tracing", () => {
    const s = serverSentryOptions("https://k@o1.ingest.de.sentry.io/1");
    expect(s.sendDefaultPii).toBe(false);
    expect(s.includeLocalVariables).toBe(false);
    expect(s.tracesSampleRate).toBeUndefined();
    expect(s.beforeSendTransaction!({} as never, {})).toBeNull();
  });

  it("has no session replay in the browser", () => {
    const c = clientSentryOptions("https://k@o1.ingest.de.sentry.io/1");
    expect(c.replaysSessionSampleRate).toBe(0);
    expect(c.replaysOnErrorSampleRate).toBe(0);
    const integrations = c.integrations as (d: { name: string }[]) => { name: string }[];
    expect(integrations([{ name: "Replay" }, { name: "Breadcrumbs" }, { name: "BrowserTracing" }]).map((i) => i.name)).toEqual(["Breadcrumbs"]);
  });
});

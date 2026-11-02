import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CASES, ROUTE_CASES, type Call, type Case, type Hit } from "./isolation-cases";
import { crossLinks, fingerprint, seedPractice, type Practice } from "./db-fixtures";
import { TEST_DATABASE_URL, assertThrowawayDatabase, resetTestSchema, truncateAll } from "./db-harness";

// Two made-up practices on a real Postgres. See isolation-cases.ts for what
// each case attacks. Skipped unless TEST_DATABASE_URL is set.

const mocks = vi.hoisted(() => {
  const url = (process.env.TEST_DATABASE_URL ?? "").trim();
  if (url) {
    const u = new URL(url);
    u.searchParams.set("schema", "isolation");
    process.env.DATABASE_URL = u.toString();
    process.env.NOTES_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    process.env.AUTH_SECRET = "test-only-secret";
  }
  return {
    actor: { id: null as string | null },
    ip: { value: 1 },
    emails: [] as unknown[],
    morningCalls: [] as string[],
  };
});

vi.mock("@/auth", () => ({
  auth: async () => (mocks.actor.id ? { user: { id: mocks.actor.id } } : { user: null }),
  signIn: async () => undefined,
  signOut: async () => undefined,
  unstable_update: async () => undefined,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": `10.0.0.${mocks.ip.value++}` }),
  cookies: async () => ({ get: () => undefined, set: () => undefined }),
}));
vi.mock("@/lib/email", () => ({
  sendEmail: async (m: unknown) => {
    mocks.emails.push(m);
    return { ok: true };
  },
}));
// No real morning call, ever: requests stop here and are counted
vi.mock("@/lib/morning", async (original) => {
  const real = await original<typeof import("@/lib/morning")>();
  return {
    ...real,
    createMorningDocument: async () => {
      mocks.morningCalls.push("create");
      const n = mocks.morningCalls.length;
      return { ok: true, data: { id: `issued-${n}`, number: 5000 + n, url: {} } };
    },
    previewMorningDocument: async () => {
      mocks.morningCalls.push("preview");
      return { ok: true, data: "cGRm" };
    },
    searchMorningDocuments: async () => {
      mocks.morningCalls.push("search");
      return { ok: true, data: [] };
    },
    testMorningConnection: async () => ({ ok: true }),
  };
});

const ACTION_MODULES: Record<string, () => Promise<Record<string, unknown>>> = {
  clients: () => import("@/server/actions/clients"),
  "client-documents": () => import("@/server/actions/client-documents"),
  files: () => import("@/server/actions/files"),
  expenses: () => import("@/server/actions/expenses"),
  documents: () => import("@/server/actions/documents"),
  "morning-docs": () => import("@/server/actions/morning-docs"),
  invoices: () => import("@/server/actions/invoices"),
  payments: () => import("@/server/actions/payments"),
  notes: () => import("@/server/actions/notes"),
  sessions: () => import("@/server/actions/sessions"),
  inbox: () => import("@/server/actions/inbox"),
  todos: () => import("@/server/actions/todos"),
  "meeting-types": () => import("@/server/actions/meeting-types"),
  waitlist: () => import("@/server/actions/waitlist"),
  invites: () => import("@/server/actions/invites"),
  subscription: () => import("@/server/actions/subscription"),
  support: () => import("@/server/actions/support"),
};

const ROUTE_MODULES: Record<string, () => Promise<Record<string, unknown>>> = {
  "clients/[id]/summaries": () => import("@/app/api/clients/[id]/summaries/route"),
  "invoices/[id]/pdf": () => import("@/app/api/invoices/[id]/pdf/route"),
  "documents/[id]": () => import("@/app/api/documents/[id]/route"),
  "expenses/[id]": () => import("@/app/api/expenses/[id]/route"),
  "files/[id]": () => import("@/app/api/files/[id]/route"),
  "support/[id]/attachment": () => import("@/app/api/support/[id]/attachment/route"),
  "calendar/[token]": () => import("@/app/api/calendar/[token]/route"),
  inbox: () => import("@/app/api/inbox/route"),
};

const call: Call = async (key, ...args) => {
  const [file, name] = key.split(".");
  const mod = await ACTION_MODULES[file]();
  return (mod[name] as (...a: unknown[]) => Promise<unknown>)(...args);
};

const hit: Hit = async (key, url, opts = {}) => {
  const mod = await ROUTE_MODULES[key]();
  const method = opts.method ?? "GET";
  const handler = mod[method] as (req: Request, ctx: unknown) => Promise<Response>;
  const req = new Request(`http://test.local${url}`, { method, body: opts.body, headers: opts.headers });
  return handler(req, { params: Promise.resolve(opts.params ?? {}) });
};

/** What came back from a call, as text — thrown errors included. */
async function outcome(
  run: () => Promise<unknown>,
): Promise<{ value: unknown; text: string; status?: number }> {
  try {
    const value = await run();
    const list = Array.isArray(value) ? value : [value];
    const parts: string[] = [];
    let status: number | undefined;
    for (const v of list) {
      if (v instanceof Response) {
        status = v.status;
        parts.push(await v.clone().text());
      } else {
        parts.push(JSON.stringify(v) ?? "");
      }
    }
    return { value, text: parts.join("\n"), status };
  } catch (err) {
    return { value: undefined, text: err instanceof Error ? err.message : String(err) };
  }
}

describe.skipIf(!TEST_DATABASE_URL)("isolation between practices (real Postgres)", () => {
  type Db = typeof import("@/lib/db").dbAll;
  let db: Db;
  let a: Practice;
  let b: Practice;
  let admin: Practice;

  beforeAll(async () => {
    assertThrowawayDatabase(TEST_DATABASE_URL);
    await resetTestSchema("isolation");
    db = (await import("@/lib/db")).dbAll;
  }, 120_000);

  beforeEach(async () => {
    await truncateAll(db);
    a = await seedPractice(db, "A");
    b = await seedPractice(db, "B");
    admin = await seedPractice(db, "Z", { isAdmin: true });
    mocks.emails.length = 0;
    mocks.morningCalls.length = 0;
  });

  afterEach(() => {
    mocks.actor.id = null;
  });

  async function refused(c: Case, actor: Practice | null) {
    const before = await fingerprint(db, a.userId);
    mocks.actor.id = actor?.userId ?? null;
    const got = await outcome(() => c.run({ call, hit, target: a, me: actor ?? b, mode: "attack" }));
    mocks.actor.id = null;
    expect(got.text).not.toContain(a.canary);
    if (got.status !== undefined) expect([400, 401, 403, 404]).toContain(got.status);
    expect(await fingerprint(db, a.userId)).toBe(before);
    expect(await crossLinks(db)).toEqual([]);
    expect(mocks.emails).toEqual([]);
    expect(mocks.morningCalls).toEqual([]);
  }

  async function worksForOwner(c: Case) {
    const before = await fingerprint(db, a.userId);
    mocks.actor.id = (c.admin ? admin : a).userId;
    const got = await outcome(() => c.run({ call, hit, target: a, me: a, mode: "control" }));
    mocks.actor.id = null;
    if (c.control === "writes") {
      expect(await fingerprint(db, a.userId), `result: ${got.text.slice(0, 300)}`).not.toBe(before);
    } else if (c.control === "reads") {
      expect(got.text).toContain(a.canary);
    } else {
      expect(c.control(got.value), `result: ${got.text.slice(0, 300)}`).toBe(true);
    }
    expect(await crossLinks(db)).toEqual([]);
  }

  const all: [string, Case][] = [
    ...Object.entries(CASES),
    ...Object.entries(ROUTE_CASES).map(([k, v]): [string, Case] => [`route ${k}`, v]),
  ];

  describe.each(all)("%s", (_name, c) => {
    it("refuses another practice", () => refused(c, b), 30_000);
    it("refuses a guest", () => refused(c, null), 30_000);
    it("works for its owner (control)", () => worksForOwner(c), 30_000);
  });

  describe("reads that take no id stay inside the practice", () => {
    const FROM = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    const TO = new Date(Date.now() + 800 * 24 * 60 * 60 * 1000);

    it("the income loaders return only the caller's rows", async () => {
      const { loadInvoicePayments, loadSessions } = await import("@/lib/income-data");
      const sessions = await loadSessions(b.userId, FROM, TO);
      const payments = await loadInvoicePayments(b.userId, FROM, TO);
      expect(sessions.length).toBeGreaterThan(0);
      expect(payments.length).toBeGreaterThan(0);
      expect(JSON.stringify([sessions, payments])).not.toContain(a.canary);
    });

    it("/api/reports/income needs a session and answers for the signed-in user", async () => {
      const mod = await import("@/app/api/reports/income/route");
      const url = "http://test.local/api/reports/income?from=2026-01-01&to=2026-12-31";
      expect((await mod.GET(new Request(url))).status).toBe(401);
      mocks.actor.id = b.userId;
      expect((await mod.GET(new Request(url))).status).toBe(200);
    }, 30_000);

    it("a practice's calendar feed holds its own meetings and never another's", async () => {
      const feed = await hit("calendar/[token]", `/api/calendar/${b.calendarToken}`, {
        params: { token: b.calendarToken },
      });
      const text = await feed.text();
      expect(text).toContain(b.canary);
      expect(text).not.toContain(a.canary);
    });

    it("the inbox API files a message under the key's owner only", async () => {
      const res = await hit("inbox", "/api/inbox", {
        method: "POST",
        body: "הודעה חדשה",
        headers: { authorization: `Bearer ${b.inboxApiToken}`, "content-type": "text/plain" },
      });
      expect(res.status).toBe(200);
      expect(await db.inboxMessage.count({ where: { userId: b.userId } })).toBe(2);
      expect(await db.inboxMessage.count({ where: { userId: a.userId } })).toBe(1);
    });

    it("the admin reads a support attachment, the sender too, nobody else", async () => {
      const get = (actor: Practice) => {
        mocks.actor.id = actor.userId;
        return hit("support/[id]/attachment", "/x", { params: { id: a.supportId } });
      };
      expect((await get(admin)).status).toBe(200);
      expect((await get(a)).status).toBe(200);
      expect((await get(b)).status).toBe(404);
    });
  });
});

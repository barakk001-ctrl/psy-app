// The full document flow through morning ("מסמך חדש"): payloads + mocked HTTP.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildMorningDocumentPayload,
  clearMorningTokenCache,
  createMorningDocument,
  morningDocUrl,
  morningTokenUrl,
  previewMorningDocument,
  testMorningConnection,
} from "@/lib/morning";
import type { DocumentDraft } from "@/lib/billing-docs";
import { credentialsFromRow } from "@/lib/morning-credentials";

describe("credentialsFromRow (the credential store)", () => {
  const row = { morningApiKeyId: "kid", morningApiSecret: "packed", morningSandbox: false, morningKeySource: "MANUAL" };
  it("decrypts stored keys and keeps their source", () => {
    expect(credentialsFromRow(row, (p) => `plain:${p}`)).toEqual({
      keyId: "kid",
      secret: "plain:packed",
      sandbox: false,
      source: "MANUAL",
    });
    expect(credentialsFromRow({ ...row, morningKeySource: "PARTNER" }, (p) => p)?.source).toBe("PARTNER");
    expect(credentialsFromRow({ ...row, morningKeySource: null }, (p) => p)?.source).toBe("MANUAL");
  });
  it("is null when not connected or the secret can't be read", () => {
    expect(credentialsFromRow(null)).toBeNull();
    expect(credentialsFromRow({ ...row, morningApiSecret: null })).toBeNull();
    expect(
      credentialsFromRow(row, () => {
        throw new Error("bad key");
      }),
    ).toBeNull();
  });
});


const draft: DocumentDraft = {
  kind: "TAX_INVOICE_RECEIPT",
  clientName: " דנה כהן ",
  clientTaxId: "000000018",
  clientEmail: null,
  date: "2026-10-14",
  vatIncluded: true,
  description: "",
  items: [
    { description: "פגישת טיפול 7.10", quantity: 1, unitPriceAgorot: 47200 },
    { description: "פגישת טיפול 14.10", quantity: 1, unitPriceAgorot: 47200 },
  ],
  payments: [
    {
      method: "BANK_TRANSFER",
      date: "2026-10-14",
      amountAgorot: 60000,
      bankName: "לאומי",
      bankBranch: "800",
      bankAccount: "123456",
    },
    { method: "PAYBOX", date: "2026-10-13", amountAgorot: 34400, reference: "PB-77" },
  ],
  remarks: "תודה!",
};

describe("buildMorningDocumentPayload", () => {
  it("builds an invoice-receipt with income and receipt lines", () => {
    const p = buildMorningDocumentPayload(draft, { vatLiable: true }) as Record<string, any>;
    expect(p).toMatchObject({ type: 320, date: "2026-10-14", lang: "he", currency: "ILS", vatType: 0 });
    expect(p.client).toEqual({ name: "דנה כהן", taxId: "000000018", add: false });
    expect(p.income).toEqual([
      { description: "פגישת טיפול 7.10", quantity: 1, price: 472, currency: "ILS", vatType: 1 },
      { description: "פגישת טיפול 14.10", quantity: 1, price: 472, currency: "ILS", vatType: 1 },
    ]);
    expect(p.payment).toEqual([
      {
        type: 4,
        date: "2026-10-14",
        price: 600,
        currency: "ILS",
        bankName: "לאומי",
        bankBranch: "800",
        bankAccount: "123456",
      },
      { type: 10, appType: 3, date: "2026-10-13", price: 344, currency: "ILS", transactionId: "PB-77" },
    ]);
    expect(p.remarks).toBe("תודה!");
    expect(p).not.toHaveProperty("description"); // empty → left out
    expect(p).not.toHaveProperty("dueDate");
  });

  it("adds VAT on top when prices exclude it (income vatType 0)", () => {
    const p = buildMorningDocumentPayload(
      { ...draft, kind: "TAX_INVOICE", vatIncluded: false, dueDate: "2026-10-31", payments: [] },
      { vatLiable: true },
    ) as Record<string, any>;
    expect(p.type).toBe(305);
    expect(p.income[0].vatType).toBe(0);
    expect(p.dueDate).toBe("2026-10-31");
    expect(p).not.toHaveProperty("payment");
  });

  it("emails the document only when asked", () => {
    const p = buildMorningDocumentPayload(
      { ...draft, clientEmail: "dana@example.com" },
      { vatLiable: true },
    ) as Record<string, any>;
    expect(p.client.emails).toEqual(["dana@example.com"]);
  });

  it("maps cards, cheques, Bit and cash", () => {
    const p = buildMorningDocumentPayload(
      {
        ...draft,
        kind: "RECEIPT",
        items: [],
        payments: [
          {
            method: "CREDIT_CARD",
            date: "2026-10-14",
            amountAgorot: 90000,
            cardType: "VISA",
            cardLast4: "4242",
            dealType: "INSTALLMENTS",
            installments: 3,
          },
          {
            method: "CHECK",
            date: "2026-10-14",
            amountAgorot: 45000,
            bankName: "12",
            bankBranch: "600",
            bankAccount: "999",
            chequeNumber: "10002",
          },
          { method: "BIT", date: "2026-10-14", amountAgorot: 45000 },
          { method: "CASH", date: "2026-10-14", amountAgorot: 100 },
        ],
      },
      { vatLiable: false },
    ) as Record<string, any>;
    expect(p.payment[0]).toEqual({
      type: 3,
      date: "2026-10-14",
      price: 900,
      currency: "ILS",
      cardType: 2,
      cardNum: "4242",
      dealType: 2,
      numPayments: 3,
    });
    expect(p.payment[1]).toMatchObject({
      type: 2,
      chequeNum: "10002",
      bankName: "12",
      bankBranch: "600",
      bankAccount: "999",
    });
    expect(p.payment[2]).toEqual({ type: 10, appType: 1, date: "2026-10-14", price: 450, currency: "ILS" });
    expect(p.payment[3]).toEqual({ type: 1, date: "2026-10-14", price: 1, currency: "ILS" });
  });

  it("gives a receipt one income row for what was received, or its meetings when they add up", () => {
    const receipt = { ...draft, kind: "RECEIPT" as const, description: "טיפולים באוקטובר" };
    const one = buildMorningDocumentPayload(
      { ...receipt, payments: [{ method: "CASH" as const, date: "2026-10-14", amountAgorot: 94400 }], items: [] },
      { vatLiable: true },
    ) as Record<string, any>;
    expect(one.type).toBe(400);
    expect(one.description).toBe("טיפולים באוקטובר");
    expect(one.income).toEqual([
      { description: "טיפולים באוקטובר", quantity: 1, price: 944, currency: "ILS", vatType: 1 },
    ]);
    // the two meetings (944) match what was received
    const matched = buildMorningDocumentPayload(receipt, { vatLiable: true }) as Record<string, any>;
    expect(matched.income).toHaveLength(2);
    const mismatched = buildMorningDocumentPayload(
      { ...receipt, payments: [{ method: "CASH" as const, date: "2026-10-14", amountAgorot: 50000 }] },
      { vatLiable: true },
    ) as Record<string, any>;
    expect(mismatched.income).toEqual([
      { description: "טיפולים באוקטובר", quantity: 1, price: 500, currency: "ILS", vatType: 1 },
    ]);
  });

  it("links a credit note to the invoice it cancels", () => {
    const p = buildMorningDocumentPayload(
      { ...draft, kind: "CREDIT_NOTE", payments: [] },
      { vatLiable: true, linkedDocumentIds: ["orig-1"], linkType: "cancel" },
    ) as Record<string, any>;
    expect(p.type).toBe(330);
    expect(p.linkedDocumentIds).toEqual(["orig-1"]);
    expect(p.linkType).toBe("cancel");
    expect(p).not.toHaveProperty("payment");
  });

  it("prefers the Hebrew document link", () => {
    expect(morningDocUrl({ url: { origin: "o", he: "h" } })).toBe("h");
    expect(morningDocUrl({ url: { origin: "o" } })).toBe("o");
    expect(morningDocUrl({})).toBeNull();
  });
});

describe("morning HTTP (mocked — no real calls)", () => {
  const creds = { keyId: "key-id", secret: "s3cret", sandbox: true, source: "MANUAL" as const };
  let calls: { url: string; init: RequestInit }[] = [];

  function mockFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>) {
    calls = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return handler(url, init);
      }),
    );
  }
  const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...headers },
    });
  const header = (i: number, name: string) => (calls[i].init.headers as Record<string, string>)[name];

  beforeEach(() => clearMorningTokenCache());
  afterEach(() => vi.unstubAllGlobals());

  it("gets an OAuth token from the sandbox token host and reuses it", async () => {
    mockFetch((url) => {
      if (url === morningTokenUrl(true)) {
        return json({
          accessToken: "jwt-1",
          tokenType: "Bearer",
          expiresAt: Math.floor(Date.now() / 1000) + 3600,
        });
      }
      return json({ id: "doc-1", number: 20017, url: { he: "https://morning/doc-1" } }, 201);
    });
    const r = await createMorningDocument("user-1", creds, { type: 400 });
    expect(r).toEqual({
      ok: true,
      data: { id: "doc-1", number: 20017, url: { he: "https://morning/doc-1" } },
    });
    expect(calls[0].url).toBe("https://api.sandbox.morning.dev/idp/v1/oauth/token");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      grant_type: "client_credentials",
      client_id: "key-id",
      client_secret: "s3cret",
    });
    expect(calls[1].url).toBe("https://sandbox.d.greeninvoice.co.il/api/v1/documents");
    expect(calls[1].init.method).toBe("POST");
    expect(header(1, "Authorization")).toBe("Bearer jwt-1");
    expect(JSON.parse(String(calls[1].init.body))).toEqual({ type: 400 });

    await createMorningDocument("user-1", creds, { type: 400 });
    expect(calls.filter((c) => c.url.includes("oauth"))).toHaveLength(1);
  });

  it("falls back to the older token endpoint when OAuth refuses", async () => {
    mockFetch((url) => {
      if (url.includes("oauth")) return json({ error: "invalid_client" }, 401);
      if (url.endsWith("/account/token")) return json({}, 200, { "X-Authorization-Bearer": "legacy-jwt" });
      return json({ file: "JVBERi0=" });
    });
    const r = await previewMorningDocument("user-2", { ...creds, sandbox: false }, { type: 320 });
    expect(r).toEqual({ ok: true, data: "JVBERi0=" });
    expect(calls[0].url).toBe("https://api.morning.co/idp/v1/oauth/token");
    expect(calls[1].url).toBe("https://api.greeninvoice.co.il/api/v1/account/token");
    expect(calls[2].url).toBe("https://api.greeninvoice.co.il/api/v1/documents/preview");
    expect(header(2, "Authorization")).toBe("Bearer legacy-jwt");
  });

  it("reports morning's error message", async () => {
    mockFetch((url) => {
      if (url.includes("oauth")) return json({ accessToken: "jwt" });
      return json({ errorCode: 2422, errorMessage: "סכום התקבולים אינו תואם" }, 400);
    });
    const r = await createMorningDocument("user-3", creds, {});
    expect(r).toEqual({ ok: false, error: "morning 400: סכום התקבולים אינו תואם (2422)" });
  });

  it("marks a write that got no answer as uncertain", async () => {
    mockFetch((url) => {
      if (url.includes("oauth")) return json({ accessToken: "jwt" });
      throw new Error("network down");
    });
    const r = await createMorningDocument("user-4", creds, {});
    expect(r).toMatchObject({ ok: false, uncertain: true });
  });

  it("partner-delivered keys don't call morning until that flow is built", async () => {
    mockFetch(() => json({ accessToken: "should-not-be-used" }));
    const r = await createMorningDocument("user-6", { ...creds, source: "PARTNER" }, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("תוכנית השותפים");
    expect(calls).toHaveLength(0);
  });

  it("explains a failed connection test", async () => {
    mockFetch((url) =>
      url.includes("oauth")
        ? json(
            {
              error: "unauthorized_client",
              error_description: "No active subscription, or subscription does not include API access",
            },
            400,
          )
        : json({ errorMessage: "bad key" }, 401),
    );
    const r = await testMorningConnection("user-5", creds);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("subscription does not include API access");
  });
});

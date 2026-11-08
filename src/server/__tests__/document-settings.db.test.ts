import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { seedPractice, type Practice } from "./db-fixtures";
import { TEST_DATABASE_URL, assertThrowawayDatabase, form, resetTestSchema, truncateAll } from "./db-harness";
import { DEFAULT_EMAIL_SUBJECT } from "@/lib/document-look";

// Settings → הגדרות עסק / הגדרות מסמכים on a real Postgres, made-up practices.
// Skipped unless TEST_DATABASE_URL is set.

const mocks = vi.hoisted(() => {
  const url = (process.env.TEST_DATABASE_URL ?? "").trim();
  if (url) {
    const u = new URL(url);
    u.searchParams.set("schema", "document_settings");
    process.env.DATABASE_URL = u.toString();
    process.env.NOTES_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    process.env.AUTH_SECRET = "test-only-secret";
  }
  return { actor: { id: null as string | null } };
});

vi.mock("@/auth", () => ({
  auth: async () => (mocks.actor.id ? { user: { id: mocks.actor.id } } : { user: null }),
  unstable_update: async () => undefined,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

type Db = typeof import("@/lib/db").db;
type Actions = typeof import("@/server/actions/settings");

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

describe.skipIf(!TEST_DATABASE_URL)("document settings (real Postgres)", () => {
  let db: Db;
  let act: Actions;
  let a: Practice;
  let b: Practice;

  beforeAll(async () => {
    assertThrowawayDatabase(TEST_DATABASE_URL);
    await resetTestSchema("document_settings");
    db = (await import("@/lib/db")).db;
    act = await import("@/server/actions/settings");
  }, 120_000);

  beforeEach(async () => {
    await truncateAll(db as never);
    a = await seedPractice(db as never, "A");
    b = await seedPractice(db as never, "B");
    mocks.actor.id = a.userId;
  });

  afterEach(() => {
    mocks.actor.id = null;
  });

  const user = (id: string) => db.user.findUniqueOrThrow({ where: { id } });

  it("saves the business details for documents, and the setup wizard's short form leaves them alone", async () => {
    const full = {
      businessName: "קליניקה",
      businessId: "000000018",
      vatLiable: "true",
      address: "רחוב 1",
      defaultRate: "450",
      occupation: "פסיכולוגיה",
      businessDescription: "טיפול רגשי",
      phone: "050-0000000",
      docEmail: "clinic@example.test",
      website: "www.example.test",
      businessNameEn: "Clinic",
      addressEn: "1 Street",
      descriptionEn: "Therapy",
    };
    expect(await act.updateBusinessInfoAction(null, form(full))).toEqual({ saved: true });
    let u = await user(a.userId);
    expect([u.occupation, u.businessDescription, u.phone, u.docEmail, u.website, u.businessNameEn]).toEqual([
      "פסיכולוגיה",
      "טיפול רגשי",
      "050-0000000",
      "clinic@example.test",
      "www.example.test",
      "Clinic",
    ]);

    // The wizard sends only its own fields
    const short = { businessName: "שם חדש", businessId: "000000018", vatLiable: "true", address: "רחוב 2", defaultRate: "" };
    expect(await act.updateBusinessInfoAction(null, form(short))).toEqual({ saved: true });
    u = await user(a.userId);
    expect(u.businessName).toBe("שם חדש");
    expect(u.occupation).toBe("פסיכולוגיה");
    expect(u.phone).toBe("050-0000000");

    const bad = await act.updateBusinessInfoAction(null, form({ ...full, docEmail: "לא מייל" }));
    expect(bad?.fieldErrors?.docEmail).toBeTruthy();
    // B is untouched
    expect((await user(b.userId)).occupation).toBeNull();
  });

  it("the personal details form no longer clears the phone", async () => {
    await db.user.update({ where: { id: a.userId }, data: { phone: "050-1111111" } });
    const me = await user(a.userId);
    expect(await act.updatePersonalDetailsAction(null, form({ name: "שם מלא", email: me.email }))).toEqual({ saved: true });
    expect((await user(a.userId)).phone).toBe("050-1111111");
  });

  it("keeps the template, color and signature, and refuses anything else", async () => {
    expect(
      await act.updateDocumentLookAction(null, form({ docTemplate: "band", docColor: "navy", signature: PNG })),
    ).toEqual({ saved: true });
    let u = await user(a.userId);
    expect([u.docTemplate, u.docColor, u.signatureUrl]).toEqual(["band", "navy", PNG]);

    // "" keeps the signature
    await act.updateDocumentLookAction(null, form({ docTemplate: "minimal", docColor: "plum", signature: "" }));
    expect((await user(a.userId)).signatureUrl).toBe(PNG);

    const svg = "data:image/svg+xml;base64,PHN2Zz4=";
    expect((await act.updateDocumentLookAction(null, form({ docTemplate: "band", docColor: "navy", signature: svg })))?.error).toBeTruthy();
    expect((await act.updateDocumentLookAction(null, form({ docTemplate: "fancy", docColor: "navy", signature: "" })))?.error).toBeTruthy();
    u = await user(a.userId);
    expect([u.docTemplate, u.docColor, u.signatureUrl]).toEqual(["minimal", "plum", PNG]);

    await act.updateDocumentLookAction(null, form({ docTemplate: "classic", docColor: "sage", signature: "REMOVE" }));
    expect((await user(a.userId)).signatureUrl).toBeNull();
    expect((await user(b.userId)).docTemplate).toBe("classic");
  });

  it("stores the email text only when it differs from the default", async () => {
    await act.updateDocumentEmailAction(null, form({ docEmailSubject: DEFAULT_EMAIL_SUBJECT, docEmailBody: "שלום {שם הלקוח}" }));
    const u = await user(a.userId);
    expect(u.docEmailSubject).toBeNull();
    expect(u.docEmailBody).toBe("שלום {שם הלקוח}");
    const long = await act.updateDocumentEmailAction(null, form({ docEmailSubject: "א".repeat(200), docEmailBody: "" }));
    expect(long?.error).toBeTruthy();
  });

  it("numbers: whole positive numbers per type, nothing saved when one is wrong", async () => {
    await db.user.update({ where: { id: a.userId }, data: { vatLiable: true } });
    const ok = await act.updateDocumentNumberingAction(
      null,
      form({ docNextTaxInvoice: "20017", docNextTaxInvoiceReceipt: "30001", docNextReceipt: "512", docNextCreditNote: "7" }),
    );
    expect(ok).toEqual({ saved: true });
    let u = await user(a.userId);
    expect([u.docNextTaxInvoice, u.docNextTaxInvoiceReceipt, u.docNextReceipt, u.docNextCreditNote]).toEqual([20017, 30001, 512, 7]);

    const bad = await act.updateDocumentNumberingAction(
      null,
      form({ docNextTaxInvoice: "0", docNextTaxInvoiceReceipt: "1.5", docNextReceipt: "600", docNextCreditNote: "-3" }),
    );
    expect(Object.keys(bad?.fieldErrors ?? {}).sort()).toEqual(["docNextCreditNote", "docNextTaxInvoice", "docNextTaxInvoiceReceipt"]);
    u = await user(a.userId);
    expect(u.docNextReceipt).toBe(512);
    expect((await user(b.userId)).docNextTaxInvoice).toBe(1);
  });

  it("an exempt business sets the receipt number only", async () => {
    await db.user.update({ where: { id: a.userId }, data: { vatLiable: false } });
    await act.updateDocumentNumberingAction(null, form({ docNextReceipt: "100", docNextTaxInvoice: "999" }));
    const u = await user(a.userId);
    expect(u.docNextReceipt).toBe(100);
    expect(u.docNextTaxInvoice).toBe(1);
  });
});

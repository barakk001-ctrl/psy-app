import { describe, expect, it, vi } from "vitest";
import {
  MAX_ATTACHMENT_BYTES,
  SUPPORT_FALLBACK_EMAIL,
  attachmentMetaError,
  checkAttachment,
  safeFileName,
  sanitizePagePath,
  sniffImageType,
  submitSupportRequest,
  supportRecipient,
} from "../support-request";
import { buildSupportEmail, escapeHtml } from "../support-email";
import { supportRequestSchema } from "../../server/validators/support";

const ascii = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const HEIC = new Uint8Array([0, 0, 0, 0x18, ...ascii("ftypheic"), 0, 0, 0, 0]);
const WEBP = ascii("RIFF\0\0\0\0WEBPVP8 ");
const PDF = ascii("%PDF-1.7 hello");

describe("supportRecipient", () => {
  it("uses SUPPORT_EMAIL when set, else the fallback", () => {
    expect(supportRecipient({ SUPPORT_EMAIL: "help@example.com" })).toBe("help@example.com");
    expect(supportRecipient({ SUPPORT_EMAIL: "  " })).toBe(SUPPORT_FALLBACK_EMAIL);
    expect(supportRecipient({ SUPPORT_EMAIL: "not-an-email" })).toBe(SUPPORT_FALLBACK_EMAIL);
    expect(supportRecipient({})).toBe("barakk001@gmail.com");
  });
});

describe("attachment checks", () => {
  it("recognises image signatures", () => {
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(sniffImageType(HEIC)).toBe("image/heic");
    expect(sniffImageType(WEBP)).toBe("image/webp");
    expect(sniffImageType(ascii("GIF89a....."))).toBe("image/gif");
    expect(sniffImageType(PDF)).toBeNull();
    expect(sniffImageType(new Uint8Array())).toBeNull();
  });

  it("limits size and type before uploading", () => {
    expect(attachmentMetaError({ name: "a.png", type: "image/png", size: 1000 })).toBeNull();
    expect(
      attachmentMetaError({ name: "a.png", type: "image/png", size: MAX_ATTACHMENT_BYTES + 1 }),
    ).toMatch(/גדול מדי/);
    expect(attachmentMetaError({ name: "a.png", type: "image/png", size: 0 })).toMatch(/ריק/);
    expect(attachmentMetaError({ name: "a.pdf", type: "application/pdf", size: 1000 })).toMatch(/רק תמונה/);
    // iPhone HEIC can arrive with no type — the bytes decide on the server
    expect(attachmentMetaError({ name: "IMG_1.HEIC", type: "", size: 1000 })).toBeNull();
  });

  it("rejects a file whose bytes are not an image, whatever its name says", () => {
    const r = checkAttachment({ name: "shot.png", type: "image/png", size: PDF.length }, PDF);
    expect(r.ok).toBe(false);
  });

  it("uses the sniffed type and a safe name", () => {
    const r = checkAttachment({ name: "צילום מסך.png", type: "image/png", size: JPEG.length }, JPEG);
    expect(r).toEqual({ ok: true, type: "image/jpeg", name: "צילום מסך.jpg" });
    expect(safeFileName('../../x"<y>.png', "image/png")).toBe("....xy.png");
    expect(safeFileName("", "image/heic")).toBe("screenshot.heic");
  });
});

describe("sanitizePagePath", () => {
  it("keeps the kind of page but never record ids or queries", () => {
    expect(sanitizePagePath("/clients/cm1abc23def/edit")).toBe("/clients/:id/edit");
    expect(sanitizePagePath("/sessions/ckx9z")).toBe("/sessions/:id");
    expect(sanitizePagePath("/clients?view=trash&q=כהן")).toBe("/clients");
    expect(sanitizePagePath("/calendar#x")).toBe("/calendar");
    expect(sanitizePagePath("/")).toBe("/");
    expect(sanitizePagePath("https://evil.example/x")).toBeNull();
    expect(sanitizePagePath("")).toBeNull();
  });
});

describe("supportRequestSchema", () => {
  const valid = {
    name: "קרן",
    email: "keren@example.com",
    phone: "",
    subject: "שאלה על קבלות",
    message: "לא מצליחה למצוא איפה מורידים קבלה",
    pagePath: "/invoices",
  };
  const errors = (over: Record<string, string>) => {
    const r = supportRequestSchema.safeParse({ ...valid, ...over });
    return r.success ? {} : r.error.flatten().fieldErrors;
  };

  it("accepts a valid request and trims it", () => {
    const r = supportRequestSchema.safeParse({ ...valid, subject: "  שאלה  " });
    expect(r.success && r.data.subject).toBe("שאלה");
  });
  it("requires name, a valid email, a subject and a real description", () => {
    expect(errors({ name: "" }).name).toBeDefined();
    expect(errors({ email: "nope" }).email).toEqual(["כתובת אימייל לא תקינה"]);
    expect(errors({ subject: " " }).subject).toBeDefined();
    expect(errors({ message: "קצר" }).message).toBeDefined();
    expect(errors({ message: "א".repeat(5001) }).message).toBeDefined();
  });
  it("keeps the phone optional but checks it when given", () => {
    expect(errors({ phone: "" }).phone).toBeUndefined();
    expect(errors({ phone: "050-123 4567" }).phone).toBeUndefined();
    expect(errors({ phone: "abc" }).phone).toEqual(["מספר טלפון לא תקין"]);
  });
});

describe("submitSupportRequest", () => {
  it("saves, emails and records success", async () => {
    const recordEmail = vi.fn(async () => {});
    const r = await submitSupportRequest({
      save: async () => ({ id: "r1" }),
      send: async () => ({ ok: true, id: "e1" }),
      recordEmail,
    });
    expect(r).toEqual({ id: "r1", emailed: true });
    expect(recordEmail).toHaveBeenCalledWith("r1", { ok: true, id: "e1" });
  });

  it("keeps the request when the email fails, and says so", async () => {
    const recordEmail = vi.fn(async () => {});
    const r = await submitSupportRequest({
      save: async () => ({ id: "r2" }),
      send: async () => ({ ok: false, error: "domain not verified" }),
      recordEmail,
    });
    expect(r).toEqual({ id: "r2", emailed: false });
    expect(recordEmail).toHaveBeenCalledWith("r2", { ok: false, error: "domain not verified" });
  });

  it("treats a throwing email sender as a failed email, not a lost request", async () => {
    const r = await submitSupportRequest({
      save: async () => ({ id: "r3" }),
      send: async () => {
        throw new Error("network down");
      },
      recordEmail: async () => {
        throw new Error("db hiccup"); // best-effort
      },
    });
    expect(r).toEqual({ id: "r3", emailed: false });
  });

  it("never emails a request that could not be saved", async () => {
    const send = vi.fn();
    await expect(
      submitSupportRequest({
        save: async () => {
          throw new Error("db down");
        },
        send,
        recordEmail: async () => {},
      }),
    ).rejects.toThrow("db down");
    expect(send).not.toHaveBeenCalled();
  });
});

describe("buildSupportEmail", () => {
  const base = {
    requestId: "r1",
    name: "קרן",
    email: "k@example.com",
    subject: "s",
    message: "m",
    submittedAt: "now",
  };

  it("escapes what the user typed", () => {
    const { html, subject, text } = buildSupportEmail({
      ...base,
      name: "<b>קרן</b>",
      subject: "בעיה\nבשורה",
      message: "<script>alert(1)</script>",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<b>קרן</b>");
    expect(subject).toBe("פנייה לתמיכה: בעיה בשורה");
    expect(text).toContain("<script>alert(1)</script>");
  });
  it("shows the account email only when it differs", () => {
    expect(buildSupportEmail({ ...base, accountEmail: "K@example.com" }).text).not.toContain("אימייל החשבון");
    expect(buildSupportEmail({ ...base, accountEmail: "other@example.com" }).text).toContain(
      "אימייל החשבון: other@example.com",
    );
  });
  it("escapeHtml covers quotes", () => {
    expect(escapeHtml(`"'&`)).toBe("&quot;&#39;&amp;");
  });
});

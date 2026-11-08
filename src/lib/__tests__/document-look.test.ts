import { describe, expect, it } from "vitest";
import {
  DEFAULT_EMAIL_BODY,
  DEFAULT_EMAIL_SUBJECT,
  DOC_COLORS,
  DOC_COLOR_KEYS,
  DOC_TEMPLATES,
  NEXT_NUMBER_FIELDS,
  NUMBERED_KINDS,
  contrastRatio,
  docLook,
  emailTexts,
  fillEmailTemplate,
  isValidSignatureDataUrl,
  parseNextNumber,
  storedEmailText,
  tint,
} from "@/lib/document-look";

describe("template and color", () => {
  it("falls back to the default for anything unknown", () => {
    expect(docLook({})).toEqual({ template: "classic", color: "sage" });
    expect(docLook({ docTemplate: "band", docColor: "navy" })).toEqual({ template: "band", color: "navy" });
    expect(docLook({ docTemplate: "<script>", docColor: "toString" })).toEqual({ template: "classic", color: "sage" });
  });
  it("offers two or three layouts and a small palette", () => {
    expect(DOC_TEMPLATES.length).toBeGreaterThanOrEqual(2);
    expect(DOC_TEMPLATES.length).toBeLessThanOrEqual(3);
    expect(DOC_COLOR_KEYS.length).toBeGreaterThanOrEqual(3);
  });
  it("every color carries white text (the band) and reads on white (titles)", () => {
    for (const k of DOC_COLOR_KEYS) {
      expect(contrastRatio(DOC_COLORS[k].hex, "#FFFFFF"), k).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("tints toward white, and dark text stays readable on a tint", () => {
    expect(tint("#000000", 1)).toBe("#FFFFFF");
    expect(tint("#000000", 0)).toBe("#000000");
    for (const k of DOC_COLOR_KEYS) {
      expect(contrastRatio("#1A1714", tint(DOC_COLORS[k].hex))).toBeGreaterThanOrEqual(7);
    }
  });
});

describe("signature image", () => {
  it("takes a small PNG or JPEG data: URL only", () => {
    expect(isValidSignatureDataUrl("data:image/png;base64,iVBORw0KGgo=")).toBe(true);
    expect(isValidSignatureDataUrl("data:image/jpeg;base64,/9j/4AAQ")).toBe(true);
    expect(isValidSignatureDataUrl("data:image/webp;base64,UklGR")).toBe(false);
    expect(isValidSignatureDataUrl("data:image/svg+xml;base64,PHN2Zz4=")).toBe(false);
    expect(isValidSignatureDataUrl("data:image/png;base64,abc\"><script>")).toBe(false);
    expect(isValidSignatureDataUrl(`data:image/png;base64,${"A".repeat(400_000)}`)).toBe(false);
  });
});

describe("email to the client", () => {
  const values = { client: "דנה לוי", docType: "קבלה", number: "20017", amount: "₪450.00", business: "קליניקה" };
  it("fills every placeholder, as often as it appears", () => {
    expect(fillEmailTemplate(DEFAULT_EMAIL_SUBJECT, values)).toBe("קבלה מספר 20017 – קליניקה");
    const body = fillEmailTemplate(DEFAULT_EMAIL_BODY, values);
    expect(body).toContain("שלום דנה לוי,");
    expect(body).toContain("על סך ₪450.00");
    expect(body).not.toContain("{");
    expect(fillEmailTemplate("{שם העסק}/{שם העסק} {אחר}", values)).toBe("קליניקה/קליניקה {אחר}");
  });
  it("stores nothing for the default or an empty box", () => {
    expect(storedEmailText("", DEFAULT_EMAIL_SUBJECT)).toBeNull();
    expect(storedEmailText(` ${DEFAULT_EMAIL_SUBJECT} `, DEFAULT_EMAIL_SUBJECT)).toBeNull();
    expect(storedEmailText(DEFAULT_EMAIL_BODY.replace(/\n/g, "\r\n"), DEFAULT_EMAIL_BODY)).toBeNull();
    expect(storedEmailText("אחר", DEFAULT_EMAIL_SUBJECT)).toBe("אחר");
  });
  it("reads the defaults when nothing is stored", () => {
    expect(emailTexts({})).toEqual({ subject: DEFAULT_EMAIL_SUBJECT, body: DEFAULT_EMAIL_BODY });
    expect(emailTexts({ docEmailSubject: "נושא" }).subject).toBe("נושא");
  });
});

describe("numbering", () => {
  it("takes whole positive numbers only", () => {
    expect(parseNextNumber("20017")).toBe(20017);
    expect(parseNextNumber(" 1 ")).toBe(1);
    expect(parseNextNumber("0")).toBeNull();
    expect(parseNextNumber("-5")).toBeNull();
    expect(parseNextNumber("12.5")).toBeNull();
    expect(parseNextNumber("1e3")).toBeNull();
    expect(parseNextNumber("")).toBeNull();
    expect(parseNextNumber("1234567890")).toBeNull();
    expect(parseNextNumber("999999999")).toBe(999_999_999);
  });
  it("has a field for each of the four document types", () => {
    expect(NUMBERED_KINDS).toHaveLength(4);
    expect(new Set(NUMBERED_KINDS.map((k) => NEXT_NUMBER_FIELDS[k])).size).toBe(4);
  });
});

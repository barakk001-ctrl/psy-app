import { describe, expect, it } from "vitest";
import { documentLogo, pdfLogo } from "@/lib/branding";

const png = "data:image/png;base64,iVBORw0KGgo=";
const webp = "data:image/webp;base64,UklGRg==";

describe("the logo on income documents", () => {
  it("is there only when the setting is ticked and there is a logo", () => {
    expect(documentLogo({ logoUrl: png, logoOnDocuments: true })).toBe(png);
    expect(documentLogo({ logoUrl: png, logoOnDocuments: false })).toBeNull();
    expect(documentLogo({ logoUrl: null, logoOnDocuments: true })).toBeNull();
    // Anything that isn't a small image data: URL never reaches the page
    expect(documentLogo({ logoUrl: "javascript:alert(1)", logoOnDocuments: true })).toBeNull();
  });
  it("reaches the PDF only as PNG or JPEG", () => {
    expect(pdfLogo(png)).toBe(png);
    expect(pdfLogo("data:image/jpeg;base64,/9j/4AAQ")).toBe("data:image/jpeg;base64,/9j/4AAQ");
    expect(pdfLogo(webp)).toBeNull();
    expect(pdfLogo(null)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { LOGO_MAX_AREA_PX, LOGO_MAX_SIDE_PX, documentLogo, logoThumbnailSize, pdfLogo } from "@/lib/branding";

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

describe("the size a picked logo is stored at", () => {
  const ratio = ({ width, height }: { width: number; height: number }) => width / height;

  it("keeps the whole picture in its own proportions, whatever its shape", () => {
    // a square is not cut, only shrunk
    expect(logoThumbnailSize(1200, 1200)).toEqual({ width: 320, height: 320 });
    // a wide logo stays wide and a tall one tall: nothing is cropped to a square
    expect(logoThumbnailSize(1800, 600)).toEqual({ width: 480, height: 160 });
    expect(logoThumbnailSize(600, 1800)).toEqual({ width: 160, height: 480 });
    for (const [w, h] of [[4032, 3024], [900, 300], [333, 1000], [2000, 250], [641, 479]]) {
      expect(ratio(logoThumbnailSize(w, h))).toBeCloseTo(w / h, 1);
    }
  });
  it("never passes either limit", () => {
    for (const [w, h] of [[4032, 3024], [3024, 4032], [5000, 5000], [6000, 300], [300, 6000], [481, 481], [700, 200]]) {
      const size = logoThumbnailSize(w, h);
      expect(Math.max(size.width, size.height)).toBeLessThanOrEqual(LOGO_MAX_SIDE_PX);
      // rounding to whole pixels may add a sliver, never more
      expect(size.width * size.height).toBeLessThanOrEqual(LOGO_MAX_AREA_PX * 1.01);
    }
  });
  it("never enlarges a small picture", () => {
    expect(logoThumbnailSize(64, 64)).toEqual({ width: 64, height: 64 });
    expect(logoThumbnailSize(300, 120)).toEqual({ width: 300, height: 120 });
    expect(logoThumbnailSize(320, 320)).toEqual({ width: 320, height: 320 });
  });
  it("survives a sliver and a picture with no size", () => {
    expect(logoThumbnailSize(4000, 2)).toEqual({ width: 480, height: 1 });
    expect(logoThumbnailSize(0, 0)).toEqual({ width: 1, height: 1 });
    expect(logoThumbnailSize(Number.NaN, 100)).toEqual({ width: 1, height: 1 });
  });
});

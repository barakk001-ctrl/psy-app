/** A practice's own name and logo in the app header.
 *
 *  The logo is stored as a small data: URL on the User row. The browser shrinks
 *  the picked image first (whole, in its own proportions: logoThumbnailSize),
 *  so there is no file storage to run and nothing to serve separately; the
 *  check below is the server's guard that what arrives really is a small image
 *  and not arbitrary markup.
 *
 *  Where it shows: whole in the large spot of the dashboard hero and the page
 *  banner (components/layout/hero-logo.tsx); as the square at its centre in
 *  the small square spots (sidebar, document header, PDF). Logos saved before
 *  2026-11-16 were cut to a 256px square on upload and stay that way until
 *  the picture is chosen again.
 */

export const LOGO_MAX_CHARS = 200_000; // ~150 KB of image; a thumbnail is far smaller
/** The stored thumbnail: no side longer than this… */
export const LOGO_MAX_SIDE_PX = 480;
/** …and no more pixels than a 320px square, so a wide or tall logo keeps
 *  detail along its long side without weighing more than a square one. The
 *  data: URL travels with every page, so this stays small on purpose. */
export const LOGO_MAX_AREA_PX = 320 * 320;

/**
 * The size to store a picked picture at: all of it, in its own proportions,
 * shrunk to fit both limits above and never enlarged (enlarging adds bytes,
 * not detail).
 */
export function logoThumbnailSize(width: number, height: number): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 1, height: 1 };
  const scale = Math.min(
    1,
    LOGO_MAX_SIDE_PX / Math.max(width, height),
    Math.sqrt(LOGO_MAX_AREA_PX / (width * height)),
  );
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

const LOGO_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;

export function isValidLogoDataUrl(value: string): boolean {
  return value.length <= LOGO_MAX_CHARS && LOGO_RE.test(value);
}

/**
 * The logo for the top of the app's document preview and draft PDFs, or
 * null: only when Settings → מיתוג has "גם בראש מסמכי ההכנסות" ticked.
 */
export function documentLogo(user: {
  logoUrl: string | null;
  logoOnDocuments: boolean;
}): string | null {
  return user.logoOnDocuments && user.logoUrl && isValidLogoDataUrl(user.logoUrl) ? user.logoUrl : null;
}

/** The PDF renderer reads PNG and JPEG only, so a WebP logo stays off the PDF. */
export function pdfLogo(logo: string | null): string | null {
  return logo && /^data:image\/(png|jpeg);base64,/.test(logo) ? logo : null;
}

/** A practice's own name and logo in the app header.
 *
 *  The logo is stored as a small data: URL on the User row. The browser shrinks
 *  the picked image to a square thumbnail first, so there is no file storage to
 *  run and nothing to serve separately; this check is the server's guard that
 *  what arrives really is a small image and not arbitrary markup.
 */

export const LOGO_MAX_CHARS = 200_000; // ~150 KB of image; a 256px thumbnail is far smaller
export const LOGO_SIZE_PX = 256;

const LOGO_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;

export function isValidLogoDataUrl(value: string): boolean {
  return value.length <= LOGO_MAX_CHARS && LOGO_RE.test(value);
}

/**
 * The logo for the top of the app's own document preview and draft PDFs, or
 * null: only when Settings → מיתוג has "גם בראש מסמכי ההכנסות" ticked. The
 * documents morning issues carry the logo of the morning account instead: its
 * API takes no logo with a document.
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

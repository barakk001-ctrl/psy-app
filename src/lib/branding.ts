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

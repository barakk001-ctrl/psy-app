// The public site: what search engines and link previews are told. The
// canonical address is fixed on purpose: the old Railway address still answers
// (see request-origin.ts) but must never be what gets indexed.

export const SITE_URL = "https://mirpaa.app";
export const SITE_NAME = "מרפאה אישית";

export const SITE_TITLE = "מרפאה אישית — מערכת לניהול קליניקה למטפלים עצמאיים";
export const SITE_DESCRIPTION =
  "יומן פגישות, תיקי לקוחות, סיכומים מוצפנים ומעקב תשלומים, בעברית, בטלפון ובמחשב. 30 יום חינם, בלי כרטיס אשראי.";

/** Link-preview image, 1200x630. Under /icons, which the middleware leaves public. */
export const OG_IMAGE = "/icons/og-image.png";

/** Public pages, for the sitemap. */
export const PUBLIC_PAGES = ["/", "/pricing", "/accessibility", "/privacy", "/terms", "/agreement"];

/** Signed-in areas and private links: nothing there for a crawler. */
export const NO_CRAWL_PATHS = [
  "/api/",
  "/request/",
  "/dashboard",
  "/calendar",
  "/clients",
  "/sessions",
  "/invoices",
  "/expenses",
  "/document",
  "/collect",
  "/reports",
  "/import",
  "/settings",
  "/my-clinic",
  "/subscription",
  "/setup",
];

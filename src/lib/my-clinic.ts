// "המרפאה שלי" (/my-clinic): the clinic's own settings gathered on one page,
// in the order they are asked about. It is a summary only — every value is
// stored and edited in its one place under "הגדרות" (/settings), and each card
// links to that section. Nothing is saved from here, so there is no second
// copy of a form to keep in step.
//
// Not on the page because they do not exist in the app (each needs a schema
// change): interface colors, opening hours, and payment details for clients
// (bank account / Bit).

import { formatCurrency } from "@/lib/format";
import { DOC_COLORS, DOC_TEMPLATE_LABELS, docLook } from "@/lib/document-look";
import { documentEmail } from "@/lib/document-business";
import { settingsHref } from "@/lib/settings-tabs";

export const MY_CLINIC_PATH = "/my-clinic";
export const MY_CLINIC_TITLE = "המרפאה שלי";

/** Shown instead of a value that was never filled in. */
export const NOT_SET = "לא הוגדר";

export type MyClinicSectionId = "name" | "logo" | "contact" | "meeting-types" | "payment" | "documents";

export type MyClinicRow = {
  label: string;
  /** null = never filled in (the page shows NOT_SET, muted) */
  value: string | null;
  /** a row edited somewhere other than the rest of its card */
  href?: string;
  /** left-to-right content (phone, web address, email) */
  ltr?: boolean;
};

export type MyClinicChip = { id: string; name: string; color: string | null };

export type MyClinicSection = {
  id: MyClinicSectionId;
  title: string;
  /** one line: what it is and where it shows */
  hint: string;
  /** where the card's "עריכה" button leads (rows with their own href aside) */
  href: string;
  rows: MyClinicRow[];
  /** the logo card: the picture itself, null when none was uploaded */
  image?: string | null;
  /** the meeting types, as chips */
  chips?: MyClinicChip[];
};

export type MyClinicUser = {
  email?: string | null;
  brandName: string | null;
  businessName: string | null;
  logoUrl: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  docEmail: string | null;
  businessId: string | null;
  /** Decimal as a string, or a number */
  defaultRate: string | number | null;
  vatLiable: boolean;
  defaultSessionMinutes: number | null;
  docTemplate: string | null;
  docColor: string | null;
  signatureUrl: string | null;
  logoOnDocuments: boolean;
};

const text = (v: string | null | undefined): string | null => v?.trim() || null;

/**
 * The cards of the page, in order. `documents` is the DOCUMENTS_ENABLED switch
 * (src/lib/features.ts): while it is off there is no document design card and
 * no document email row.
 */
export function myClinicSections(
  user: MyClinicUser,
  meetingTypes: MyClinicChip[],
  documents: boolean,
): MyClinicSection[] {
  const business = settingsHref("business", "business");
  const branding = settingsHref("business", "branding");

  const sections: MyClinicSection[] = [
    {
      id: "name",
      title: "שם הקליניקה",
      hint: "השם לתצוגה מופיע בראש התפריט ובדוחות; שם העסק מופיע בתזכורות ללקוחות ובטופס בקשת הפגישה.",
      href: branding,
      rows: [
        { label: "שם לתצוגה", value: text(user.brandName), href: branding },
        { label: "שם העסק", value: text(user.businessName), href: business },
      ],
    },
    {
      id: "logo",
      title: "לוגו",
      hint: "מופיע בראש התפריט ובמסך הבית.",
      href: branding,
      rows: [{ label: "תמונה או לוגו", value: user.logoUrl ? "הועלה" : null }],
      image: user.logoUrl || null,
    },
    {
      id: "contact",
      title: "פרטי התקשרות",
      hint: documents ? "מופיעים בראש המסמכים, מתחת לשם העסק." : "הטלפון, הכתובת והאתר של הקליניקה.",
      href: settingsHref("business", "contact"),
      rows: [
        { label: "טלפון", value: text(user.phone), ltr: true },
        { label: "כתובת", value: text(user.address) },
        { label: "אתר", value: text(user.website), ltr: true },
        ...(documents
          ? [{ label: "אימייל למסמכים", value: documentEmail(user.docEmail, user.email), ltr: true }]
          : []),
      ],
    },
    {
      id: "meeting-types",
      title: "סוגי הטיפולים",
      hint: "סוגי המפגשים שבוחרים מהם בקביעת פגישה, והצבע של כל אחד ביומן.",
      href: settingsHref("calendar", "meeting-types"),
      rows: [
        {
          label: "משך פגישה רגיל",
          value: user.defaultSessionMinutes ? `${user.defaultSessionMinutes} דקות` : null,
        },
      ],
      chips: meetingTypes,
    },
    {
      id: "payment",
      title: "פרטי תשלום",
      hint: "תעריף ברירת המחדל לפגישה ופרטי העוסק.",
      href: business,
      rows: [
        {
          label: "תעריף ברירת מחדל לפגישה",
          value: user.defaultRate === null || user.defaultRate === "" ? null : formatCurrency(user.defaultRate),
        },
        { label: "סטטוס מע״מ", value: user.vatLiable ? "עוסק מורשה" : "עוסק פטור" },
        { label: "ע.מ / ע.פ / ח.פ", value: text(user.businessId), ltr: true },
      ],
    },
  ];

  if (documents) {
    const look = docLook({ docTemplate: user.docTemplate, docColor: user.docColor });
    sections.push({
      id: "documents",
      title: "עיצוב מסמכים",
      hint: "התבנית, הצבע והחתימה של מסמכי ההכנסות.",
      href: settingsHref("documents", "document-look"),
      rows: [
        { label: "תבנית", value: DOC_TEMPLATE_LABELS[look.template] },
        { label: "צבע", value: DOC_COLORS[look.color].label },
        { label: "חתימה", value: user.signatureUrl ? "הועלתה" : null },
        { label: "לוגו בראש המסמכים", value: user.logoUrl && user.logoOnDocuments ? "מוצג" : "לא מוצג" },
      ],
    });
  }

  return sections;
}

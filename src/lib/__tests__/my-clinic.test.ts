import { describe, expect, it } from "vitest";
import { MY_CLINIC_PATH, myClinicSections, type MyClinicUser } from "@/lib/my-clinic";
import { NO_CRAWL_PATHS } from "@/lib/site";

const empty: MyClinicUser = {
  email: "owner@example.test",
  brandName: null,
  businessName: null,
  logoUrl: null,
  phone: null,
  address: null,
  website: null,
  docEmail: null,
  businessId: null,
  defaultRate: null,
  vatLiable: false,
  defaultSessionMinutes: null,
  docTemplate: null,
  docColor: null,
  signatureUrl: null,
  logoOnDocuments: false,
};

const full: MyClinicUser = {
  email: "owner@example.test",
  brandName: "קליניקה לדוגמה",
  businessName: "דוגמה טיפול בע״מ",
  logoUrl: "data:image/png;base64,AAAA",
  phone: "03-0000000",
  address: "רחוב הדוגמה 1, עיר",
  website: "https://example.test",
  docEmail: "office@example.test",
  businessId: "000000000",
  defaultRate: "350",
  vatLiable: true,
  defaultSessionMinutes: 50,
  docTemplate: "band",
  docColor: "navy",
  signatureUrl: "data:image/png;base64,BBBB",
  logoOnDocuments: true,
};

const types = [
  { id: "a", name: "פגישה פרטנית", color: "#3E6B6B" },
  { id: "b", name: "הדרכת הורים", color: null },
];

const row = (sections: ReturnType<typeof myClinicSections>, id: string, label: string) =>
  sections.find((s) => s.id === id)!.rows.find((r) => r.label === label)!;

describe("myClinicSections", () => {
  it("lists the cards in the order they were asked for", () => {
    expect(myClinicSections(full, types, true).map((s) => s.title)).toEqual([
      "שם הקליניקה",
      "לוגו",
      "פרטי התקשרות",
      "סוגי הטיפולים",
      "פרטי תשלום",
      "עיצוב מסמכים",
    ]);
  });

  it("has no document design card and no document email while documents are hidden", () => {
    const sections = myClinicSections(full, types, false);
    expect(sections.map((s) => s.id)).toEqual(["name", "logo", "contact", "meeting-types", "payment"]);
    expect(sections.find((s) => s.id === "contact")!.rows.map((r) => r.label)).toEqual([
      "טלפון",
      "כתובת",
      "אתר",
    ]);
    const text = JSON.stringify(sections);
    expect(text).not.toMatch(/מסמכ/);
    expect(text).not.toContain("tab=documents");
  });

  it("links every card to the settings section that stores it", () => {
    const sections = myClinicSections(full, types, true);
    const href = Object.fromEntries(sections.map((s) => [s.id, s.href]));
    expect(href).toEqual({
      name: "/settings?tab=business#branding",
      logo: "/settings?tab=business#branding",
      contact: "/settings?tab=business#contact",
      "meeting-types": "/settings?tab=calendar#meeting-types",
      payment: "/settings?tab=business#business",
      documents: "/settings?tab=documents#document-look",
    });
    // The two names are edited in two different cards of the settings
    expect(row(sections, "name", "שם לתצוגה").href).toBe("/settings?tab=business#branding");
    expect(row(sections, "name", "שם העסק").href).toBe("/settings?tab=business#business");
  });

  it("shows the stored values", () => {
    const sections = myClinicSections(full, types, true);
    expect(row(sections, "name", "שם לתצוגה").value).toBe("קליניקה לדוגמה");
    expect(row(sections, "name", "שם העסק").value).toBe("דוגמה טיפול בע״מ");
    expect(sections.find((s) => s.id === "logo")!.image).toBe(full.logoUrl);
    expect(row(sections, "contact", "טלפון")).toMatchObject({ value: "03-0000000", ltr: true });
    expect(row(sections, "contact", "אימייל למסמכים").value).toBe("office@example.test");
    expect(sections.find((s) => s.id === "meeting-types")!.chips).toEqual(types);
    expect(row(sections, "meeting-types", "משך פגישה רגיל").value).toBe("50 דקות");
    expect(row(sections, "payment", "תעריף ברירת מחדל לפגישה").value).toMatch(/350/);
    expect(row(sections, "payment", "תעריף ברירת מחדל לפגישה").value).toContain("₪");
    expect(row(sections, "payment", "סטטוס מע״מ").value).toBe("עוסק מורשה");
    expect(row(sections, "documents", "תבנית").value).toBe("פס צבע");
    expect(row(sections, "documents", "צבע").value).toBe("כחול לילה");
    expect(row(sections, "documents", "חתימה").value).toBe("הועלתה");
    expect(row(sections, "documents", "לוגו בראש המסמכים").value).toBe("מוצג");
  });

  it("leaves what was never filled in empty, and falls back like the documents do", () => {
    const sections = myClinicSections({ ...empty, brandName: "   " }, [], true);
    expect(row(sections, "name", "שם לתצוגה").value).toBeNull();
    expect(row(sections, "name", "שם העסק").value).toBeNull();
    expect(sections.find((s) => s.id === "logo")!.image).toBeNull();
    for (const label of ["טלפון", "כתובת", "אתר"]) expect(row(sections, "contact", label).value).toBeNull();
    // No document email typed: the documents use the account's own
    expect(row(sections, "contact", "אימייל למסמכים").value).toBe("owner@example.test");
    expect(row(sections, "meeting-types", "משך פגישה רגיל").value).toBeNull();
    expect(sections.find((s) => s.id === "meeting-types")!.chips).toEqual([]);
    expect(row(sections, "payment", "תעריף ברירת מחדל לפגישה").value).toBeNull();
    expect(row(sections, "payment", "סטטוס מע״מ").value).toBe("עוסק פטור");
    expect(row(sections, "payment", "ע.מ / ע.פ / ח.פ").value).toBeNull();
    // Unknown or missing look = the default one
    expect(row(sections, "documents", "תבנית").value).toBe("קלאסי");
    expect(row(sections, "documents", "צבע").value).toBe("ירוק מרווה");
    expect(row(sections, "documents", "חתימה").value).toBeNull();
    expect(row(sections, "documents", "לוגו בראש המסמכים").value).toBe("לא מוצג");
  });

  it("is a signed-in page that crawlers are told to skip", () => {
    expect(NO_CRAWL_PATHS).toContain(MY_CLINIC_PATH);
  });
});

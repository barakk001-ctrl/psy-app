import { describe, expect, it } from "vitest";
import { docBusiness, documentEmail } from "@/lib/document-business";

describe("documentEmail", () => {
  it("uses the account's email until one is saved", () => {
    expect(documentEmail(null, "me@example.test")).toBe("me@example.test");
    expect(documentEmail(undefined, "me@example.test")).toBe("me@example.test");
    expect(documentEmail(null, null)).toBeNull();
  });

  it("prints the saved one, and none when it was emptied on purpose", () => {
    expect(documentEmail("office@example.test", "me@example.test")).toBe("office@example.test");
    expect(documentEmail("", "me@example.test")).toBeNull();
    expect(documentEmail("  ", "me@example.test")).toBeNull();
  });

  it("is what docBusiness prints", () => {
    const row = {
      name: "שם",
      businessName: null,
      businessId: null,
      address: null,
      phone: null,
      vatLiable: false,
      logoUrl: null,
      logoOnDocuments: false,
      occupation: null,
      businessDescription: "משפט תיאור",
      docEmail: null,
      email: "me@example.test",
      website: null,
      signatureUrl: null,
      docTemplate: "classic",
      docColor: "sage",
    };
    expect(docBusiness(row)).toMatchObject({ email: "me@example.test", description: "משפט תיאור" });
    expect(docBusiness({ ...row, docEmail: "" }).email).toBeNull();
  });
});

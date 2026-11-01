import { describe, expect, it } from "vitest";
import {
  clientFolder,
  csvCell,
  csvLine,
  pathAllocator,
  safeFileName,
} from "@/lib/account-export-format";
import { reauthMethod } from "@/lib/reauth";

describe("csv cells", () => {
  it("quotes what would break the row", () => {
    expect(csvCell('אמר "שלום", והלך')).toBe('"אמר ""שלום"", והלך"');
    expect(csvCell("שורה\nשנייה")).toBe('"שורה\nשנייה"');
    expect(csvLine(["א", null, 3])).toBe("א,,3\r\n");
  });

  it("disarms text that a spreadsheet would run as a formula", () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvCell("-2+3+cmd")).toBe("'-2+3+cmd");
  });

  it("leaves phone numbers and negative amounts alone", () => {
    expect(csvCell("+972 50-123-4567")).toBe("+972 50-123-4567");
    expect(csvCell("-120.50")).toBe("-120.50");
  });

  it("writes money as stored, not through a float", () => {
    const decimal = { toString: () => "1234.50" };
    expect(csvCell(decimal)).toBe("1234.50");
  });
});

describe("file names", () => {
  it("drops what Windows or a ZIP can't hold", () => {
    expect(safeFileName('a/b\\c:d*e?"f<g>h|i.pdf')).toBe("a b c d e f g h i.pdf");
    expect(safeFileName("../../etc/passwd")).toBe("etc passwd");
    expect(safeFileName("   ")).toBe("קובץ");
    expect(safeFileName("...")).toBe("קובץ");
  });

  it("keeps Hebrew and two clients with one name apart", () => {
    const a = clientFolder({ id: "cl0000000aaaaaa", firstName: "דנה", lastName: "כהן" });
    const b = clientFolder({ id: "cl0000000bbbbbb", firstName: "דנה", lastName: "כהן" });
    expect(a).toBe("דנה כהן (aaaaaa)");
    expect(a).not.toBe(b);
  });

  it("numbers repeated paths instead of overwriting them", () => {
    const place = pathAllocator();
    expect(place("מסמכים/א/מכתב.pdf")).toBe("מסמכים/א/מכתב.pdf");
    expect(place("מסמכים/א/מכתב.pdf")).toBe("מסמכים/א/מכתב (2).pdf");
    expect(place("מסמכים/א/מכתב.pdf")).toBe("מסמכים/א/מכתב (3).pdf");
    expect(place("מסמכים/א.ב/ללא")).toBe("מסמכים/א.ב/ללא");
    expect(place("מסמכים/א.ב/ללא")).toBe("מסמכים/א.ב/ללא (2)");
  });
});

describe("the re-check before sensitive account actions", () => {
  it("takes the strongest thing the account has", () => {
    expect(reauthMethod({ totpEnabled: true, totpSecret: "x", hashedPassword: "h" })).toBe("totp");
    expect(reauthMethod({ totpEnabled: false, totpSecret: null, hashedPassword: "h" })).toBe("password");
    expect(reauthMethod({ totpEnabled: false, totpSecret: null, hashedPassword: null })).toBe("email");
    // A half-finished 2FA setup isn't 2FA
    expect(reauthMethod({ totpEnabled: false, totpSecret: "x", hashedPassword: "h" })).toBe("password");
  });
});

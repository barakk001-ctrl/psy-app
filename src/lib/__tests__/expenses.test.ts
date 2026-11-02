import { describe, expect, it } from "vitest";
import {
  draftAmount,
  expenseDocTypeLabel,
  expenseMonthAgorot,
  expenseProblems,
  monthTotalAgorot,
} from "@/lib/expenses";

const good = {
  docType: 305,
  docDate: "2026-10-12",
  supplier: "ספק לדוגמה",
  docNumber: "",
  amount: "118",
  vatAmount: "18",
};

describe("expense rules", () => {
  it("approves a complete expense", () => {
    expect(expenseProblems(good)).toEqual([]);
    expect(expenseProblems({ ...good, vatAmount: "" })).toEqual([]);
  });
  it("names everything that's missing", () => {
    const p = expenseProblems({ docType: null, docDate: "", supplier: " ", docNumber: "", amount: "", vatAmount: "" });
    expect(p).toHaveLength(4);
  });
  it("refuses VAT above the amount, and unreadable amounts", () => {
    expect(expenseProblems({ ...good, vatAmount: "119" }).join()).toContain("המע״מ");
    expect(expenseProblems({ ...good, vatAmount: "abc" }).join()).toContain("המע״מ");
    expect(expenseProblems({ ...good, amount: "0" }).join()).toContain("גדול מאפס");
  });
  it("refuses a type it doesn't know", () => {
    expect(expenseProblems({ ...good, docType: 999 }).join()).toContain("סוג המסמך");
  });
  it("keeps what a draft can keep", () => {
    expect(draftAmount("")).toBeNull();
    expect(draftAmount("abc")).toBeNull();
    expect(draftAmount("12.50")).toBe(1250);
  });
  it("takes a credit note off the month", () => {
    expect(expenseMonthAgorot({ docType: 330, amountAgorot: 500 })).toBe(-500);
    expect(
      monthTotalAgorot([
        { docType: 305, amountAgorot: 1000 },
        { docType: 330, amountAgorot: 300 },
      ]),
    ).toBe(700);
  });
  it("labels every type, known or not", () => {
    expect(expenseDocTypeLabel(320)).toBe("חשבונית מס / קבלה");
    expect(expenseDocTypeLabel(null)).toBe("מסמך הוצאה");
  });
});

import { describe, expect, it } from "vitest";
import {
  confirmLine,
  deleteLine,
  editLine,
  existingLine,
  lineReady,
  lineTotalAgorot,
  linesForDocument,
  newLine,
  updateLine,
  type LineRow,
} from "@/lib/doc-line-items";

let n = 0;
const blank = (rate?: string) => newLine(`k${++n}`, rate);
const filled = (key: string, description = "פגישה", quantity = "1", unitPrice = "350"): LineRow =>
  updateLine([newLine(key)], key, { description, quantity, unitPrice })[0];

describe("lineReady", () => {
  it("needs a description, a positive quantity and a price", () => {
    expect(lineReady({ description: "פגישה", quantity: "1", unitPrice: "350" })).toBe(true);
    expect(lineReady({ description: "  ", quantity: "1", unitPrice: "350" })).toBe(false);
    expect(lineReady({ description: "פגישה", quantity: "0", unitPrice: "350" })).toBe(false);
    expect(lineReady({ description: "פגישה", quantity: "", unitPrice: "350" })).toBe(false);
    expect(lineReady({ description: "פגישה", quantity: "1", unitPrice: "" })).toBe(false);
    expect(lineReady({ description: "פגישה", quantity: "1", unitPrice: "3.555" })).toBe(false);
    expect(lineReady({ description: "פגישה", quantity: "1.5", unitPrice: "0" })).toBe(true);
  });
});

describe("confirm", () => {
  it("folds a complete line", () => {
    const rows = confirmLine([filled("a")], "a");
    expect(rows[0].confirmed).toBe(true);
  });

  it("does nothing to an incomplete line", () => {
    const rows = updateLine([newLine("a")], "a", { description: "" });
    expect(confirmLine(rows, "a")[0].confirmed).toBe(false);
  });

  it("touches only the line asked for", () => {
    const rows = confirmLine([filled("a"), filled("b")], "b");
    expect(rows.map((r) => r.confirmed)).toEqual([false, true]);
  });
});

describe("edit", () => {
  it("opens a confirmed line with everything it held", () => {
    const confirmed = confirmLine([filled("a", "הדרכה", "2", "400")], "a");
    const open = editLine(confirmed, "a")[0];
    expect(open).toMatchObject({ confirmed: false, description: "הדרכה", quantity: "2", unitPrice: "400" });
    expect(linesForDocument([open])).toEqual([{ description: "הדרכה", quantity: 2, unitPriceAgorot: 40000 }]);
  });
});

describe("delete", () => {
  it("removes the line", () => {
    const rows = deleteLine([filled("a"), filled("b")], "a", () => blank());
    expect(rows.map((r) => r.key)).toEqual(["b"]);
  });

  it("leaves a blank line when the last one goes", () => {
    const rows = deleteLine([filled("a")], "a", () => blank("300"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ description: "", unitPrice: "300", fresh: true, confirmed: false });
    expect(linesForDocument(rows)).toEqual([]);
  });
});

describe("linesForDocument (save, preview, issue)", () => {
  it("includes a filled line that was never confirmed, as typed", () => {
    const rows = [confirmLine([filled("a")], "a")[0], filled("b", "אבחון", "1", "1200")];
    expect(linesForDocument(rows)).toEqual([
      { description: "פגישה", quantity: 1, unitPriceAgorot: 35000 },
      { description: "אבחון", quantity: 1, unitPriceAgorot: 120000 },
    ]);
  });

  it("includes an incomplete line someone typed in, so nothing typed is lost", () => {
    const rows = updateLine([newLine("a")], "a", { description: "חצי שורה", unitPrice: "" });
    expect(linesForDocument(rows)).toEqual([{ description: "חצי שורה", quantity: 1, unitPriceAgorot: 0 }]);
  });

  it("ignores an untouched blank line, even with the client's rate in it", () => {
    expect(linesForDocument([filled("a"), blank("350")])).toEqual([
      { description: "פגישה", quantity: 1, unitPriceAgorot: 35000 },
    ]);
  });

  it("keeps lines from a saved draft, confirmed only when complete", () => {
    const done = existingLine("a", { description: "פגישה", quantity: "1", unitPrice: "350.00" });
    const partial = existingLine("b", { description: "", quantity: "1", unitPrice: "100.00" });
    expect(done.confirmed).toBe(true);
    expect(partial.confirmed).toBe(false);
    expect(linesForDocument([done, partial])).toHaveLength(2);
  });
});

describe("lineTotalAgorot", () => {
  it("multiplies in agorot", () => {
    expect(lineTotalAgorot({ quantity: "1.5", unitPrice: "333.33" })).toBe(50000);
    expect(lineTotalAgorot({ quantity: "", unitPrice: "100" })).toBe(0);
  });
});

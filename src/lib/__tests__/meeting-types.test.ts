import { describe, expect, it } from "vitest";
import { DEFAULT_MEETING_TYPES, typesToCreate } from "../meeting-types";

describe("DEFAULT_MEETING_TYPES", () => {
  it("offers ייעוץ alongside the other standard categories", () => {
    expect(DEFAULT_MEETING_TYPES).toContain("ייעוץ");
    expect(new Set(DEFAULT_MEETING_TYPES).size).toBe(DEFAULT_MEETING_TYPES.length);
  });
});

describe("typesToCreate", () => {
  it("writes the defaults out alongside the first custom type", () => {
    // Without this the first add replaces the list, because the fallback to the
    // defaults only applies while the user owns none.
    const created = typesToCreate([], "אינטייק");
    expect(created).toEqual([...DEFAULT_MEETING_TYPES, "אינטייק"]);
  });

  it("adds only the new name once the user already has types", () => {
    expect(typesToCreate(["טיפול פרטני"], "אינטייק")).toEqual(["אינטייק"]);
  });

  it("does not duplicate a name the user already has", () => {
    expect(typesToCreate(["טיפול פרטני"], "טיפול פרטני")).toEqual([]);
  });

  it("seeds without duplicating when the first add is already a default", () => {
    // Adding "ייעוץ" on an empty list must not produce it twice.
    const created = typesToCreate([], "ייעוץ");
    expect(created).toEqual([...DEFAULT_MEETING_TYPES]);
    expect(created.filter((n) => n === "ייעוץ")).toHaveLength(1);
  });

  it("ignores a blank name but still seeds", () => {
    expect(typesToCreate([], "   ")).toEqual([...DEFAULT_MEETING_TYPES]);
    expect(typesToCreate(["טיפול פרטני"], "   ")).toEqual([]);
  });

  it("trims before comparing, so a padded duplicate is not added", () => {
    expect(typesToCreate(["אבחון"], "  אבחון  ")).toEqual([]);
  });
});

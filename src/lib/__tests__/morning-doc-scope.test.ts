import { describe, expect, it } from "vitest";
import { mapMorningSearchItem, morningDocUpsert } from "@/lib/morning";

describe("morningDocUpsert", () => {
  const mapped = mapMorningSearchItem({ id: "doc-1", number: 1001, type: 320, amount: 300 });

  it("finds the row by account + morning id, never by morning id alone", () => {
    const a = morningDocUpsert("user-a", mapped);
    const b = morningDocUpsert("user-b", mapped);
    expect(a.where).toEqual({ userId_morningId: { userId: "user-a", morningId: "doc-1" } });
    expect(b.where).toEqual({ userId_morningId: { userId: "user-b", morningId: "doc-1" } });
  });

  it("creates the row for that account, with our own id", () => {
    const { create } = morningDocUpsert("user-b", mapped);
    expect(create).toMatchObject({ userId: "user-b", morningId: "doc-1", number: "1001", docType: 320 });
    expect(create).not.toHaveProperty("id");
  });

  it("an update never moves the row to another account or changes its client", () => {
    const { update } = morningDocUpsert("user-b", mapped);
    expect(update).not.toHaveProperty("userId");
    expect(update).not.toHaveProperty("clientId");
    expect(update).not.toHaveProperty("morningId");
  });
});

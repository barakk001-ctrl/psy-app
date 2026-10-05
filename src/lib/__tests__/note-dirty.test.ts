import { describe, expect, it } from "vitest";
import { isNoteDirty, normalizeNoteText } from "@/lib/note-dirty";

describe("isNoteDirty", () => {
  it("is clean when the text matches the saved baseline", () => {
    expect(isNoteDirty("סיכום פגישה", "סיכום פגישה")).toBe(false);
    expect(isNoteDirty("", "")).toBe(false);
  });

  it("is dirty when the text differs", () => {
    expect(isNoteDirty("סיכום פגישה.", "סיכום פגישה")).toBe(true);
    expect(isNoteDirty("", "טקסט")).toBe(true);
  });

  it("ignores CRLF vs LF differences", () => {
    expect(isNoteDirty("שורה 1\nשורה 2", "שורה 1\r\nשורה 2")).toBe(false);
    expect(isNoteDirty("a\rb", "a\nb")).toBe(false);
  });

  it("still notices whitespace the user typed", () => {
    expect(isNoteDirty("טקסט ", "טקסט")).toBe(true);
    expect(isNoteDirty("טקסט\n", "טקסט")).toBe(true);
  });
});

describe("normalizeNoteText", () => {
  it("turns every line ending into LF", () => {
    expect(normalizeNoteText("a\r\nb\rc\nd")).toBe("a\nb\nc\nd");
  });
});

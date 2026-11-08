import { describe, expect, it } from "vitest";
import {
  AUTOSAVE_AFTER_MS,
  AUTOSAVE_RETRY_MS,
  autosaveDue,
  noteBaseMatches,
  noteVersion,
  parseNoteBase,
  type AutosaveState,
} from "@/lib/note-autosave";

const idle: AutosaveState = { dirtySince: null, saving: false, blocked: false, failedAt: null };
const T = 1_000_000;

describe("autosaveDue", () => {
  it("saves about a minute after the text started to change, not before", () => {
    const s = { ...idle, dirtySince: T };
    expect(autosaveDue(s, T + AUTOSAVE_AFTER_MS - 1)).toBe(false);
    expect(autosaveDue(s, T + AUTOSAVE_AFTER_MS)).toBe(true);
  });
  it("does nothing with nothing unsaved, while saving, or when stopped", () => {
    const later = T + 10 * AUTOSAVE_AFTER_MS;
    expect(autosaveDue(idle, later)).toBe(false);
    expect(autosaveDue({ ...idle, dirtySince: T, saving: true }, later)).toBe(false);
    // another tab saved meanwhile, or the stored note couldn't be read
    expect(autosaveDue({ ...idle, dirtySince: T, blocked: true }, later)).toBe(false);
  });
  it("waits a little after a failure, then tries again", () => {
    const failedAt = T + AUTOSAVE_AFTER_MS;
    const s = { ...idle, dirtySince: T, failedAt };
    expect(autosaveDue(s, failedAt + AUTOSAVE_RETRY_MS - 1)).toBe(false);
    expect(autosaveDue(s, failedAt + AUTOSAVE_RETRY_MS)).toBe(true);
  });
});

describe("note versions", () => {
  const at = new Date("2026-11-08T10:15:30.123Z");
  it("is the note's updatedAt, or empty when there is no note", () => {
    expect(noteVersion(at)).toBe("2026-11-08T10:15:30.123Z");
    expect(noteVersion(null)).toBe("");
  });
  it("reads what the editor sent", () => {
    expect(parseNoteBase(null)).toEqual({ kind: "unchecked" });
    expect(parseNoteBase("")).toEqual({ kind: "none" });
    expect(parseNoteBase("2026-11-08T10:15:30.123Z")).toEqual({ kind: "version", at });
    expect(parseNoteBase("yesterday")).toEqual({ kind: "invalid" });
    expect(parseNoteBase("2026-13-45T99:99:99Z")).toEqual({ kind: "invalid" });
  });
  it("lets a save through only onto the version it was based on", () => {
    const later = new Date(at.getTime() + 1);
    expect(noteBaseMatches({ kind: "version", at }, at)).toBe(true);
    // a newer save from another tab or device is never overwritten
    expect(noteBaseMatches({ kind: "version", at }, later)).toBe(false);
    expect(noteBaseMatches({ kind: "version", at }, null)).toBe(false);
    expect(noteBaseMatches({ kind: "none" }, null)).toBe(true);
    expect(noteBaseMatches({ kind: "none" }, at)).toBe(false);
    expect(noteBaseMatches({ kind: "invalid" }, at)).toBe(false);
    expect(noteBaseMatches({ kind: "unchecked" }, at)).toBe(true);
  });
});

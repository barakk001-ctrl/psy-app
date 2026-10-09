import { describe, expect, it } from "vitest";
import { dirtyWork, registerUnsavedWork, saveDirtyWork } from "@/lib/unsaved-work";

describe("unsaved work registry", () => {
  it("lists only dirty entries, and forgets unregistered ones", () => {
    const offA = registerUnsavedWork({ label: "א", isDirty: () => true });
    const offB = registerUnsavedWork({ label: "ב", isDirty: () => false });
    expect(dirtyWork().map((w) => w.label)).toEqual(["א"]);
    offA();
    offB();
    expect(dirtyWork()).toEqual([]);
  });

  it("saves every dirty entry and counts failures without throwing", async () => {
    const offs = [
      registerUnsavedWork({ label: "ok", isDirty: () => true, save: async () => true }),
      registerUnsavedWork({ label: "refused", isDirty: () => true, save: async () => false }),
      registerUnsavedWork({
        label: "throws",
        isDirty: () => true,
        save: async () => {
          throw new Error("offline");
        },
      }),
      registerUnsavedWork({ label: "no save", isDirty: () => true }),
      registerUnsavedWork({ label: "clean", isDirty: () => false, save: async () => true }),
    ];
    expect(await saveDirtyWork()).toEqual({ saved: 1, failed: 3 });
    offs.forEach((off) => off());
  });

  it("gives up on a save that hangs", async () => {
    const off = registerUnsavedWork({
      label: "hangs",
      isDirty: () => true,
      save: () => new Promise<boolean>(() => {}),
    });
    expect(await saveDirtyWork(20)).toEqual({ saved: 0, failed: 1 });
    off();
  });
});

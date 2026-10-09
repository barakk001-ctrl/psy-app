// Unsaved work on the page, as the automatic sign-out sees it. An editor with
// text that hasn't been saved registers itself here (useUnsavedWork); before
// the idle timer signs out, the warning dialog says so and the timer asks each
// one to save. Browser-only state, one registry per tab.

export type UnsavedWork = {
  /** Shown in the warning, e.g. "סיכום הפגישה" */
  label: string;
  isDirty: () => boolean;
  /**
   * Saves the work to the server. Resolves true when it was saved. Optional —
   * work that can't be saved this way is only warned about.
   */
  save?: () => Promise<boolean>;
};

const registry = new Map<symbol, UnsavedWork>();

/** Adds an entry; call the returned function to remove it. */
export function registerUnsavedWork(work: UnsavedWork): () => void {
  const key = Symbol(work.label);
  registry.set(key, work);
  return () => {
    registry.delete(key);
  };
}

/** The registered entries that are dirty right now. */
export function dirtyWork(): UnsavedWork[] {
  return [...registry.values()].filter((w) => {
    try {
      return w.isDirty();
    } catch {
      return false;
    }
  });
}

/**
 * Saves every dirty entry that can be saved, each within `timeoutMs`.
 * Never throws; resolves with how many were saved and how many weren't.
 */
export async function saveDirtyWork(timeoutMs = 10_000): Promise<{ saved: number; failed: number }> {
  const work = dirtyWork();
  const results = await Promise.all(
    work.map(async (w) => {
      if (!w.save) return false;
      try {
        return await Promise.race([
          w.save(),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
        ]);
      } catch {
        return false;
      }
    }),
  );
  const saved = results.filter(Boolean).length;
  return { saved, failed: results.length - saved };
}

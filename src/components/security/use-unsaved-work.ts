"use client";

import { useEffect, useRef } from "react";
import { registerUnsavedWork } from "@/lib/unsaved-work";

/**
 * Tells the automatic sign-out (IdleGuard) about an editor's unsaved text:
 * the warning mentions it, and `save` runs before signing out. The latest
 * `isDirty`/`save` are always used, so pass plain closures.
 */
export function useUnsavedWork(
  label: string,
  isDirty: () => boolean,
  save?: () => Promise<boolean>,
): void {
  const latest = useRef({ isDirty, save });
  useEffect(() => {
    latest.current = { isDirty, save };
  });
  useEffect(
    () =>
      registerUnsavedWork({
        label,
        isDirty: () => latest.current.isDirty(),
        save: () => latest.current.save?.() ?? Promise.resolve(false),
      }),
    [label],
  );
}

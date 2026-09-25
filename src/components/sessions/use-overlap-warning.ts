"use client";

import { useEffect, useState } from "react";
import { checkOverlapAction } from "@/server/actions/sessions";

/** Asks the server whether a chosen time clashes with another meeting, shortly
 *  after the time stops changing. Returns the clashing meetings as text, or null.
 *  With applyScope "future" the client's following meetings in the same slot
 *  are checked where they would land, too.
 *  Times are clinic wall-clock "yyyy-MM-ddTHH:mm". */
export function useOverlapWarning(
  startLocal: string | undefined,
  endLocal: string | undefined,
  excludeId?: string,
  enabled = true,
  applyScope: "single" | "future" = "single",
): string | null {
  const [overlap, setOverlap] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || !startLocal || !endLocal) {
      setOverlap(null);
      return;
    }
    let stale = false;
    const t = setTimeout(async () => {
      try {
        const res = await checkOverlapAction({ startLocal, endLocal, excludeId, applyScope });
        if (!stale) setOverlap(res.overlap);
      } catch {
        // offline or signed out: the save will still check
      }
    }, 400);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [startLocal, endLocal, excludeId, enabled, applyScope]);
  return overlap;
}

/** "yyyy-MM-ddTHH:mm" plus minutes, as wall-clock arithmetic. */
export function addMinutesLocal(local: string, minutes: number): string {
  const t = Date.parse(`${local}:00Z`);
  if (Number.isNaN(t)) return "";
  return new Date(t + minutes * 60_000).toISOString().slice(0, 16);
}

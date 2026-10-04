"use client";

import {
  cancelFollowingNotice,
  followingTotal,
  type FollowingCounts,
} from "@/lib/cancel-following";

/** Calendar popup, when a meeting is switched to cancelled and the client has
 *  later meetings: "only this meeting" vs "all of [client]'s following
 *  meetings". Submits `cancelScope` = single | following, and the count shown
 *  (`cancelFollowingCount`) so the server can ask again if it grew. */
export function CancelScopeChoice({
  value,
  onChange,
  clientName,
  counts,
}: {
  value: "single" | "following";
  onChange: (v: "single" | "following") => void;
  clientName: string;
  counts: FollowingCounts;
}) {
  return (
    <div className="rounded-xl border border-terracotta-500/30 bg-terracotta-500/5 px-4 py-3 space-y-2">
      <p className="text-sm font-medium text-ink-soft">מה לבטל?</p>
      <label className="flex items-center gap-2 text-sm text-ink-soft cursor-pointer">
        <input
          type="radio"
          name="cancelScope"
          value="single"
          checked={value === "single"}
          onChange={() => onChange("single")}
          className="h-4 w-4 accent-terracotta-600"
        />
        רק הפגישה הזו
      </label>
      <label className="flex items-center gap-2 text-sm text-ink-soft cursor-pointer">
        <input
          type="radio"
          name="cancelScope"
          value="following"
          checked={value === "following"}
          onChange={() => onChange("following")}
          className="h-4 w-4 accent-terracotta-600"
        />
        כל הפגישות הבאות של {clientName}
      </label>
      {value === "following" && (
        <div className="text-xs leading-relaxed space-y-1">
          <input type="hidden" name="cancelFollowingCount" value={followingTotal(counts)} />
          <p className="text-terracotta-600 font-medium">
            {cancelFollowingNotice(counts, clientName)}
          </p>
          <p className="text-ink-muted">
            פגישות שכבר עברו ופגישות שלפני הפגישה הזו לא משתנות, ולא יישלחו תזכורות לפגישות
            שהוסרו.
          </p>
        </div>
      )}
    </div>
  );
}

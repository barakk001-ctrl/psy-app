"use client";

/** "Only this meeting" vs "all of this client's following meetings" for a
 *  date/time change. Shown only when the client has later meetings in the
 *  same standing slot; submits as `applyScope` = single | future. */
export function ApplyScopeChoice({
  value,
  onChange,
  clientName,
  slotLabel,
  followers,
}: {
  value: "single" | "future";
  onChange: (v: "single" | "future") => void;
  clientName: string;
  /** "ימי שני ב-18:00" */
  slotLabel: string;
  /** how many following meetings would move along */
  followers: number;
}) {
  return (
    <div className="rounded-xl border border-cream-300 bg-white/60 px-4 py-3 space-y-2">
      <p className="text-sm font-medium text-ink-soft">
        על אילו פגישות להחיל את שינוי המועד?
      </p>
      <label className="flex items-center gap-2 text-sm text-ink-soft cursor-pointer">
        <input
          type="radio"
          name="applyScope"
          value="single"
          checked={value === "single"}
          onChange={() => onChange("single")}
          className="h-4 w-4 accent-sage-600"
        />
        רק הפגישה הזו
      </label>
      <label className="flex items-center gap-2 text-sm text-ink-soft cursor-pointer">
        <input
          type="radio"
          name="applyScope"
          value="future"
          checked={value === "future"}
          onChange={() => onChange("future")}
          className="h-4 w-4 accent-sage-600"
        />
        כל הפגישות הבאות של {clientName}
      </label>
      <p className="text-xs text-ink-subtle leading-relaxed">
        {followers === 1 ? "עוד פגישה אחת" : `עוד ${followers} פגישות`} קבועות ב{slotLabel}{" "}
        יעברו יחד איתה לשעה החדשה — ולאותו יום בשבוע החדש, אם שיניתם תאריך.
        פגישות שעברו, שבוטלו או פגישות חד-פעמיות בזמנים אחרים לא ישתנו.
      </p>
    </div>
  );
}

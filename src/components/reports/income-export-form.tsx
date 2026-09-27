"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PdfButton } from "@/components/ui/pdf-button";
import { cn } from "@/lib/utils";

function lastDayOfMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(d).padStart(2, "0")}`;
}

/** Pick a month or a date range and export the income report as a PDF. */
export function IncomeExportForm({
  defaultFrom,
  defaultTo,
}: {
  defaultFrom: string; // yyyy-mm-dd
  defaultTo: string;
}) {
  const [mode, setMode] = useState<"month" | "range">("month");
  const [month, setMonth] = useState(defaultTo.slice(0, 7));
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  const range =
    mode === "month"
      ? month
        ? { from: `${month}-01`, to: lastDayOfMonth(month) }
        : null
      : from && to && from <= to
        ? { from, to }
        : null;

  return (
    <div className="space-y-4">
      <div className="inline-flex bg-cream-100 border border-cream-300 rounded-full p-1">
        {(
          [
            ["month", "חודש"],
            ["range", "טווח תאריכים"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
              mode === key ? "bg-white text-ink shadow-soft" : "text-ink-muted hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {mode === "month" ? (
          <div>
            <Label htmlFor="export-month">חודש</Label>
            <Input
              id="export-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-44"
            />
          </div>
        ) : (
          <>
            <div>
              <Label htmlFor="export-from">מתאריך</Label>
              <Input
                id="export-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-44"
              />
            </div>
            <div>
              <Label htmlFor="export-to">עד תאריך</Label>
              <Input
                id="export-to"
                type="date"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
                className="w-44"
              />
            </div>
          </>
        )}
        <PdfButton
          variant="primary"
          label="הפקת דוח PDF"
          disabled={!range}
          url={range ? `/api/reports/income?from=${range.from}&to=${range.to}` : "#"}
          fileName={range ? `income-${range.from}-${range.to}.pdf` : "income.pdf"}
        />
      </div>
      {mode === "range" && from && to && from > to && (
        <p className="text-xs text-terracotta-600">תאריך הסיום לפני תאריך ההתחלה.</p>
      )}
    </div>
  );
}

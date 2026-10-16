"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ClientCombobox } from "@/components/ui/client-combobox";
import {
  PERIOD_OPTIONS,
  followUpHref,
  hasActiveFilters,
  periodShortLabel,
  sessionCountLabel,
  type ClientChoice,
  type FollowUpFilters,
  type PeriodKey,
  type StatusOption,
} from "@/lib/follow-up-filters";
import { cn } from "@/lib/utils";

/**
 * The filter bar of /document and /collect: client (type-ahead), status
 * (pills) and period (select + custom dates). Every change navigates to the
 * page with the filters in the URL — the page itself filters in its query.
 * On phones the controls fold under a "סינון" button; the summary line
 * (count, active filters, "נקה סינון") is always visible.
 */
export function FollowUpFiltersBar<S extends string>({
  basePath,
  filters,
  statuses,
  defaultStatus,
  clients,
  count,
}: {
  basePath: string;
  filters: FollowUpFilters<S>;
  statuses: StatusOption<S>[];
  defaultStatus: S;
  clients: ClientChoice[];
  count: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const active = hasActiveFilters(filters, defaultStatus);
  // Open on phones only when she taps "סינון" (or a filter is already active)
  const [open, setOpen] = useState(active);
  // The custom-range inputs are local until both dates are set
  const [customMode, setCustomMode] = useState(filters.period === "custom");
  const [from, setFrom] = useState(filters.from ?? "");
  const [to, setTo] = useState(filters.to ?? "");

  const go = (next: Partial<FollowUpFilters<S>>) => {
    // A new filter starts from the first page
    const href = followUpHref(basePath, { ...filters, ...next, limit: undefined }, defaultStatus);
    startTransition(() => router.push(href, { scroll: false }));
  };

  const onPeriod = (key: PeriodKey) => {
    if (key === "custom") {
      setCustomMode(true);
      if (from && to && from <= to) go({ period: "custom", from, to });
      return;
    }
    setCustomMode(false);
    go({ period: key, from: null, to: null });
  };

  const onDates = (f: string, t: string) => {
    setFrom(f);
    setTo(t);
    if (f && t && f <= t) go({ period: "custom", from: f, to: t });
  };

  const selectedClient = filters.clientId ? clients.find((c) => c.id === filters.clientId) : null;
  const statusLabel = statuses.find((s) => s.key === filters.status)?.label;

  return (
    <div className="rounded-2xl border border-cream-200/80 bg-white/80 backdrop-blur-sm shadow-soft">
      {/* Summary line — always visible */}
      <div className="flex items-center gap-2 px-4 py-3 text-sm">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="follow-up-filter-panel"
          className="sm:hidden inline-flex items-center gap-1.5 rounded-full border border-cream-300 bg-white px-3 py-1.5 text-xs font-medium text-ink shrink-0"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          סינון
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
        </button>
        <p className="flex-1 min-w-0 text-ink-muted truncate">
          <span className="font-medium text-ink">{sessionCountLabel(count)}</span>
          <span className="hidden sm:inline">
            {" · "}
            {periodShortLabel(filters)}
            {selectedClient && ` · ${selectedClient.name}`}
            {filters.status !== defaultStatus && statusLabel && ` · ${statusLabel}`}
          </span>
        </p>
        {active && (
          <Link
            href={basePath}
            scroll={false}
            onClick={() => {
              setCustomMode(false);
              setFrom("");
              setTo("");
            }}
            className="inline-flex items-center gap-1 text-xs font-medium text-terracotta-600 hover:text-terracotta-500 shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            נקה סינון
          </Link>
        )}
      </div>

      {/* Controls — folded on phones until "סינון" is tapped */}
      <div
        id="follow-up-filter-panel"
        className={cn("border-t border-cream-200 px-4 py-4 space-y-4", !open && "hidden sm:block")}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="follow-up-client">מטופל/ת</Label>
            <ClientCombobox
              id="follow-up-client"
              clients={clients}
              value={filters.clientId}
              onChange={(id) => go({ clientId: id })}
            />
          </div>
          <div>
            <Label htmlFor="follow-up-period">תקופה</Label>
            <Select
              id="follow-up-period"
              value={customMode ? "custom" : filters.period}
              onChange={(e) => onPeriod(e.target.value as PeriodKey)}
            >
              {PERIOD_OPTIONS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {customMode && (
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <div>
              <Label htmlFor="follow-up-from">מתאריך</Label>
              <Input
                id="follow-up-from"
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => onDates(e.target.value, to)}
              />
            </div>
            <div>
              <Label htmlFor="follow-up-to">עד תאריך</Label>
              <Input
                id="follow-up-to"
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => onDates(from, e.target.value)}
              />
            </div>
            {from && to && from > to && (
              <p className="col-span-2 text-xs text-terracotta-600">תאריך הסיום לפני תאריך ההתחלה.</p>
            )}
            {(!from || !to) && (
              <p className="col-span-2 text-xs text-ink-muted">בוחרים את שני התאריכים והרשימה מתעדכנת.</p>
            )}
          </div>
        )}

        <div>
          <span className="text-sm font-medium text-ink-soft mb-1.5 block">סטטוס</span>
          <div className="inline-flex flex-wrap bg-cream-100 border border-cream-300 rounded-full p-1" role="group">
            {statuses.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={filters.status === s.key}
                onClick={() => go({ status: s.key })}
                className={cn(
                  "px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors",
                  filters.status === s.key ? "bg-white text-ink shadow-soft" : "text-ink-muted hover:text-ink",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** "הצגת עוד" — grows the list in place (the URL keeps the row count). */
export function ShowMoreLink<S extends string>({
  basePath,
  filters,
  defaultStatus,
  remaining,
  step,
}: {
  basePath: string;
  filters: FollowUpFilters<S>;
  defaultStatus: S;
  remaining: number;
  step: number;
}) {
  return (
    <div className="text-center">
      <Link
        href={followUpHref(basePath, { ...filters, limit: filters.limit + step }, defaultStatus)}
        scroll={false}
        className="inline-flex items-center justify-center h-10 px-5 rounded-xl text-sm font-medium bg-white/70 text-ink border border-cream-300 shadow-soft hover:bg-white"
      >
        הצגת עוד ({Math.min(step, remaining)} מתוך {remaining} נוספות)
      </Link>
    </div>
  );
}

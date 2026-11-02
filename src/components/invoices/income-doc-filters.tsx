"use client";

import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  DOC_PERIODS,
  DOC_STATUS_FILTERS,
  DOC_TYPE_FILTERS,
  docListHref,
  type DocListFilters,
  type DocPeriod,
  type DocStatusFilter,
} from "@/lib/income-doc-list";

/** Period, type and status of the income documents. They live in the URL. */
export function IncomeDocFilters({ filters }: { filters: DocListFilters }) {
  const router = useRouter();
  const update = (patch: Partial<DocListFilters>) => router.push(docListHref({ ...filters, ...patch }));

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="col-span-2 sm:col-span-1">
          <Label className="text-xs" htmlFor="docs-period">תקופה</Label>
          <Select
            id="docs-period"
            className="h-10"
            value={filters.period}
            onChange={(e) => update({ period: e.target.value as DocPeriod })}
          >
            {DOC_PERIODS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label className="text-xs" htmlFor="docs-type">סוג מסמך</Label>
          <Select
            id="docs-type"
            className="h-10"
            value={filters.type}
            onChange={(e) => update({ type: e.target.value })}
          >
            {DOC_TYPE_FILTERS.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label className="text-xs" htmlFor="docs-status">סטטוס</Label>
          <Select
            id="docs-status"
            className="h-10"
            value={filters.status}
            onChange={(e) => update({ status: e.target.value as DocStatusFilter })}
          >
            {DOC_STATUS_FILTERS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {filters.period === "custom" && (
        <div className="grid grid-cols-2 gap-2 sm:max-w-md">
          <div>
            <Label className="text-xs" htmlFor="docs-from">מתאריך</Label>
            <Input
              id="docs-from"
              type="date"
              className="h-10"
              defaultValue={filters.from}
              onBlur={(e) => e.target.value !== filters.from && update({ from: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs" htmlFor="docs-to">עד תאריך</Label>
            <Input
              id="docs-to"
              type="date"
              className="h-10"
              defaultValue={filters.to}
              onBlur={(e) => e.target.value !== filters.to && update({ to: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  DOC_PERIODS,
  DOC_STATUS_FILTERS,
  DOC_TYPE_FILTERS,
  type DocListFilters,
  type DocPeriod,
  type DocStatusFilter,
} from "@/lib/income-doc-list";

/**
 * Period, type and status of the income documents. `IncomeDocuments` applies
 * them in place. The form's GET stays as what a press does before the page's
 * scripts have loaded.
 */
export function IncomeDocFilters({
  filters,
  onChange,
  onDates,
}: {
  filters: DocListFilters;
  onChange: (patch: Partial<DocListFilters>) => void;
  /** The dates are typed first and shown on "הצגה" */
  onDates: (patch: Pick<DocListFilters, "from" | "to">) => void;
}) {
  return (
    <form
      method="get"
      action="/invoices"
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        onChange({ from: String(fd.get("from") ?? ""), to: String(fd.get("to") ?? "") });
      }}
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="col-span-2 sm:col-span-1">
          <Label className="text-xs" htmlFor="docs-period">תקופה</Label>
          <Select
            id="docs-period"
            name="period"
            className="h-10"
            value={filters.period}
            onChange={(e) => onChange({ period: e.target.value as DocPeriod })}
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
            name="type"
            className="h-10"
            value={filters.type}
            onChange={(e) => onChange({ type: e.target.value })}
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
            name="status"
            className="h-10"
            value={filters.status}
            onChange={(e) => onChange({ status: e.target.value as DocStatusFilter })}
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
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-xs" htmlFor="docs-from">מתאריך</Label>
            <Input
              id="docs-from"
              name="from"
              type="date"
              className="h-10"
              value={filters.from}
              onChange={(e) => onDates({ from: e.target.value, to: filters.to })}
            />
          </div>
          <div>
            <Label className="text-xs" htmlFor="docs-to">עד תאריך</Label>
            <Input
              id="docs-to"
              name="to"
              type="date"
              className="h-10"
              value={filters.to}
              onChange={(e) => onDates({ from: filters.from, to: e.target.value })}
            />
          </div>
          <Button type="submit" size="sm" variant="secondary">
            הצגה
          </Button>
        </div>
      )}
    </form>
  );
}

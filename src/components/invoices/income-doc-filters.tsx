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
} from "@/lib/income-doc-list";

/**
 * Period, type and status of the income documents. A plain GET form on
 * purpose: `router.push` was seen to drop these navigations silently (the
 * server answered, the page never moved), and a full load can't. It doesn't
 * ask for Face ID again, since the unlock lasts the app session.
 */
export function IncomeDocFilters({ filters }: { filters: DocListFilters }) {
  const submit = (e: React.ChangeEvent<HTMLSelectElement>) => e.currentTarget.form?.submit();

  return (
    <form method="get" action="/invoices" className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="col-span-2 sm:col-span-1">
          <Label className="text-xs" htmlFor="docs-period">תקופה</Label>
          <Select id="docs-period" name="period" className="h-10" defaultValue={filters.period} onChange={submit}>
            {DOC_PERIODS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label className="text-xs" htmlFor="docs-type">סוג מסמך</Label>
          <Select id="docs-type" name="type" className="h-10" defaultValue={filters.type} onChange={submit}>
            {DOC_TYPE_FILTERS.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label className="text-xs" htmlFor="docs-status">סטטוס</Label>
          <Select id="docs-status" name="status" className="h-10" defaultValue={filters.status} onChange={submit}>
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
            <Input id="docs-from" name="from" type="date" className="h-10" defaultValue={filters.from} />
          </div>
          <div>
            <Label className="text-xs" htmlFor="docs-to">עד תאריך</Label>
            <Input id="docs-to" name="to" type="date" className="h-10" defaultValue={filters.to} />
          </div>
          <Button type="submit" size="sm" variant="secondary">
            הצגה
          </Button>
        </div>
      )}
    </form>
  );
}

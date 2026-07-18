"use client";

import { useActionState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  assignMorningDocumentAction,
  syncMorningDocumentsAction,
  type MorningSyncState,
} from "@/server/actions/morning-docs";

const DOC_TYPE_LABELS: Record<number, string> = {
  400: "קבלה",
  320: "חשבונית מס-קבלה",
  305: "חשבונית מס",
};

export type MorningDocRow = {
  id: string;
  number: string | null;
  docType: number | null;
  docDate: string | null; // pre-formatted
  amount: string | null; // pre-formatted
  morningClientName: string | null;
  url: string | null;
};

export function MorningDocsPanel({
  docs,
  clients,
}: {
  docs: MorningDocRow[];
  clients: { id: string; name: string }[];
}) {
  const [state, syncAction, syncing] = useActionState<MorningSyncState, FormData>(
    syncMorningDocumentsAction,
    null,
  );

  return (
    <Card>
      <CardHeader className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>מסמכים כלליים מ-morning</CardTitle>
          <p className="text-xs text-ink-muted mt-1">
            חשבוניות וקבלות שהופקו ישירות ב-morning, מחוץ ללו״ז הקבוע — ממתינות
            לשיוך ללקוח/ה.
          </p>
        </div>
        <form action={syncAction}>
          <Button type="submit" variant="secondary" size="sm" disabled={syncing}>
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "מושך…" : "משיכה מ-morning"}
          </Button>
        </form>
      </CardHeader>
      <CardContent className="p-0">
        {state?.error && (
          <div className="px-5 py-3 text-sm text-terracotta-600 border-b border-cream-200">
            {state.error}
          </div>
        )}
        {state?.synced !== undefined && !state.error && (
          <div className="px-5 py-3 text-sm text-sage-700 border-b border-cream-200">
            הסתיים — {state.synced} מסמכים נמשכו מ-morning.
          </div>
        )}
        {docs.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-ink-muted">
            אין מסמכים שממתינים לשיוך. לחצו על ״משיכה מ-morning״ כדי לבדוק אם יש
            חדשים.
          </div>
        ) : (
          <ul className="divide-y divide-cream-200">
            {docs.map((d) => (
              <li
                key={d.id}
                className="px-5 py-4 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm text-ink flex items-center gap-2">
                    <span>
                      {DOC_TYPE_LABELS[d.docType ?? 0] ?? "מסמך"}{" "}
                      {d.number && <span dir="ltr">{d.number}</span>}
                    </span>
                    {d.url && (
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sage-600 hover:text-sage-700"
                        aria-label="פתיחה ב-morning"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                  <div className="text-xs text-ink-muted mt-0.5">
                    {d.docDate}
                    {d.amount && <> · {d.amount}</>}
                    {d.morningClientName && <> · {d.morningClientName}</>}
                  </div>
                </div>
                <form
                  action={assignMorningDocumentAction}
                  className="flex items-center gap-2"
                >
                  <input type="hidden" name="docId" value={d.id} />
                  <Select
                    name="clientId"
                    required
                    defaultValue=""
                    className="h-9 text-sm min-w-40"
                  >
                    <option value="" disabled>
                      בחר/י לקוח/ה
                    </option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                  <Button type="submit" size="sm" variant="secondary">
                    שיוך
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

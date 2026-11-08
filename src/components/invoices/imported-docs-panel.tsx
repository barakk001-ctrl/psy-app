import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { assignImportedDocumentAction } from "@/server/actions/document-numbers";

const DOC_TYPE_LABELS: Record<number, string> = {
  400: "קבלה",
  320: "חשבונית מס/קבלה",
  305: "חשבונית מס",
  330: "חשבונית זיכוי",
};

export type ImportedDocRow = {
  id: string;
  number: string | null;
  docType: number | null;
  docDate: string | null; // pre-formatted
  amount: string | null; // pre-formatted
  clientNameOnDoc: string | null;
  url: string | null;
};

/**
 * Documents imported in the past from an external invoicing system and not yet
 * assigned to a client. Nothing new is imported any more; shown only while
 * some are still waiting.
 */
export function ImportedDocsPanel({
  docs,
  clients,
}: {
  docs: ImportedDocRow[];
  clients: { id: string; name: string }[];
}) {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle>מסמכים שיובאו וממתינים לשיוך</CardTitle>
        <p className="text-xs text-ink-muted">
          מסמכים שיובאו בעבר ממערכת חיצונית ועדיין לא שויכו ללקוח/ה.
        </p>
      </CardHeader>
      <CardContent className="p-0">
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
                      aria-label="פתיחת המסמך"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
                <div className="text-xs text-ink-muted mt-0.5">
                  {d.docDate}
                  {d.amount && <> · {d.amount}</>}
                  {d.clientNameOnDoc && <> · {d.clientNameOnDoc}</>}
                </div>
              </div>
              <form action={assignImportedDocumentAction} className="flex items-center gap-2">
                <input type="hidden" name="docId" value={d.id} />
                <Select
                  name="clientId"
                  required
                  defaultValue=""
                  aria-label="לקוח/ה לשיוך"
                  className="h-9 text-sm min-w-40"
                >
                  <option value="" disabled>
                    בחירת לקוח/ה
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
      </CardContent>
    </Card>
  );
}

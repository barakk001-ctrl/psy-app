import Link from "next/link";
import { ScrollText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

const ACTION_LABELS: Record<string, string> = {
  NOTE_VIEW: "צפייה בסיכום פגישה",
  RECORD_VIEW: "צפייה בתיק טיפולי",
  NOTE_SAVE: "שמירת סיכום",
  NOTE_DELETE: "מחיקת סיכום",
  NOTE_APPEND: "צירוף הודעה לסיכום",
};

export type AuditEntry = {
  id: string;
  action: string;
  createdAt: Date;
  sessionId: string | null;
  clientId: string | null;
  clientName: string | null;
};

export function AuditLogCard({ entries }: { entries: AuditEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScrollText className="w-5 h-5 text-sage-600" />
          יומן גישה לרשומות
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-ink-muted leading-relaxed mb-3">
          תיעוד אוטומטי של כל צפייה, שמירה או מחיקה של סיכומים קליניים בחשבון
          זה — חלק מאמצעי אבטחת המידע של המערכת.
        </p>
        {entries.length === 0 ? (
          <p className="text-sm text-ink-subtle">אין עדיין רישומים.</p>
        ) : (
          <ul className="divide-y divide-cream-200 text-sm">
            {entries.map((e) => (
              <li key={e.id} className="py-2 flex items-center justify-between gap-3">
                <span className="text-ink-soft">
                  {ACTION_LABELS[e.action] ?? e.action}
                  {e.clientName && (
                    <>
                      {" · "}
                      {e.clientId ? (
                        <Link
                          href={`/clients/${e.clientId}`}
                          className="text-sage-600 hover:text-sage-700"
                        >
                          {e.clientName}
                        </Link>
                      ) : (
                        e.clientName
                      )}
                    </>
                  )}
                </span>
                <span className="text-xs text-ink-muted shrink-0">
                  {formatDateTime(e.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

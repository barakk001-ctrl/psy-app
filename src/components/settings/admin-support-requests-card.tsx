import { LifeBuoy, Paperclip } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { setSupportRequestStatusAction } from "@/server/actions/support";

export type AdminSupportRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  pagePath: string | null;
  hasAttachment: boolean;
  emailStatus: string;
  status: string;
  createdAt: Date;
};

const EMAIL_BADGE: Record<string, { label: string; cls: string }> = {
  SENT: { label: "נשלח במייל", cls: "bg-sage-100 text-sage-700" },
  FAILED: { label: "המייל נכשל — ננסה שוב", cls: "bg-terracotta-500/15 text-terracotta-600" },
  PENDING: { label: "בשליחה", cls: "bg-cream-200 text-ink-muted" },
};

/** Operator only: the support requests saved from the help widget — the place
 *  to read them even when the email to support failed. */
export function AdminSupportRequestsCard({ requests }: { requests: AdminSupportRow[] }) {
  const open = requests.filter((r) => r.status !== "DONE").length;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LifeBuoy className="w-5 h-5 text-sage-600" />
          פניות תמיכה
          {open > 0 && (
            <span className="text-xs font-sans font-medium rounded-full bg-sage-600 text-cream-50 px-2 py-0.5">
              {open} פתוחות
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <p className="text-sm text-ink-muted">עדיין לא התקבלו פניות.</p>
        ) : (
          <ul className="divide-y divide-cream-200">
            {requests.map((r) => {
              const badge = EMAIL_BADGE[r.emailStatus] ?? EMAIL_BADGE.PENDING;
              const done = r.status === "DONE";
              return (
                <li key={r.id} className={cn("py-4 space-y-2", done && "opacity-60")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{r.subject}</span>
                    <span className={cn("text-[11px] rounded-full px-2 py-0.5", badge.cls)}>
                      {badge.label}
                    </span>
                    {done && (
                      <span className="text-[11px] rounded-full px-2 py-0.5 bg-cream-200 text-ink-muted">
                        טופל
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-ink-muted flex flex-wrap gap-x-3 gap-y-1">
                    <span>{formatDateTime(r.createdAt)}</span>
                    <span>{r.name}</span>
                    <a href={`mailto:${r.email}`} dir="ltr" className="text-sage-700 hover:underline">
                      {r.email}
                    </a>
                    {r.phone && <span dir="ltr">{r.phone}</span>}
                    {r.pagePath && <span dir="ltr">{r.pagePath}</span>}
                  </div>
                  <p className="text-sm text-ink-soft whitespace-pre-wrap leading-relaxed">{r.message}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {r.hasAttachment && (
                      <a
                        href={`/api/support/${r.id}/attachment`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-sage-700 hover:underline"
                      >
                        <Paperclip className="w-4 h-4" />
                        צילום מסך
                      </a>
                    )}
                    <form action={setSupportRequestStatusAction} className="ms-auto">
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="status" value={done ? "OPEN" : "DONE"} />
                      <Button type="submit" size="sm" variant="secondary">
                        {done ? "פתיחה מחדש" : "סימון כטופל"}
                      </Button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

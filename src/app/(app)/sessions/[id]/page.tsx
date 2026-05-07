import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  Clock,
  MapPin,
  Video,
  ExternalLink,
  User as UserIcon,
} from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { decryptNote } from "@/lib/crypto";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatTime, formatCurrency } from "@/lib/format";
import { SessionStatusBadge } from "@/components/sessions/session-status-badge";
import { SessionStatusActions } from "@/components/sessions/session-status-actions";
import { NoteEditor } from "@/components/sessions/note-editor";

const LOCATION_LABELS = {
  OFFICE: "קליניקה",
  ONLINE: "מקוון",
  HOME_VISIT: "ביקור בית",
  OTHER: "אחר",
} as const;

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user.id;

  const sess = await db.session.findFirst({
    where: { id, userId },
    include: {
      client: {
        select: { id: true, firstName: true, lastName: true, phone: true },
      },
      note: true,
      reminderJobs: {
        orderBy: { scheduledFor: "asc" },
      },
    },
  });

  if (!sess) notFound();

  // Decrypt server-side. The plaintext flows down to the NoteEditor client component
  // because the user already has authorization to read their own note.
  let initialNote = "";
  if (sess.note) {
    try {
      initialNote = decryptNote({
        contentCiphertext: sess.note.contentCiphertext,
        contentIv: sess.note.contentIv,
        contentTag: sess.note.contentTag,
      });
    } catch (err) {
      console.error("Failed to decrypt note", err);
      initialNote = "";
    }
  }

  return (
    <div className="max-w-5xl space-y-8">
      <Link
        href="/calendar"
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
        חזרה ליומן
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <SessionStatusBadge status={sess.status} />
            {sess.location === "ONLINE" && (
              <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                <Video className="w-3.5 h-3.5" />
                מקוון
              </span>
            )}
          </div>
          <h1 className="font-display text-3xl text-ink">
            {sess.client.firstName} {sess.client.lastName}
          </h1>
          <div className="text-ink-muted mt-1 text-sm flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {formatDateTime(sess.startsAt)} – {formatTime(sess.endsAt)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {LOCATION_LABELS[sess.location]}
            </span>
            {sess.rate && <span>{formatCurrency(sess.rate.toString())}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <SessionStatusActions sessionId={sess.id} currentStatus={sess.status} />
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>סיכום הפגישה</CardTitle>
          </CardHeader>
          <CardContent>
            <NoteEditor sessionId={sess.id} initialContent={initialNote} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>פרטים</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <Link
                href={`/clients/${sess.client.id}`}
                className="inline-flex items-center gap-2 text-ink-soft hover:text-ink"
              >
                <UserIcon className="w-4 h-4 text-ink-subtle" />
                כרטיס הלקוח
              </Link>
            </div>
            {sess.client.phone && (
              <div className="text-ink-soft">
                <span className="text-xs text-ink-muted block mb-0.5">טלפון</span>
                <a
                  href={`tel:${sess.client.phone}`}
                  className="hover:text-sage-600"
                  dir="ltr"
                >
                  {sess.client.phone}
                </a>
              </div>
            )}
            {sess.meetingUrl && (
              <div>
                <span className="text-xs text-ink-muted block mb-0.5">קישור לפגישה</span>
                <a
                  href={sess.meetingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sage-600 hover:text-sage-700"
                >
                  פתיחה
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
            <div className="pt-3 border-t border-cream-200 text-xs text-ink-muted space-y-1">
              <div>נוצר: {formatDateTime(sess.createdAt)}</div>
              {sess.updatedAt.getTime() !== sess.createdAt.getTime() && (
                <div>עודכן: {formatDateTime(sess.updatedAt)}</div>
              )}
            </div>
          </CardContent>
        </Card>

        {sess.reminderJobs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>תזכורות ללקוח/ה</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {sess.reminderJobs.map((j) => {
                const statusLabel = {
                  PENDING: "מתוכננת",
                  SENT: "נשלחה",
                  FAILED: "נכשלה",
                  CANCELLED: "בוטלה",
                }[j.status];
                const statusColor = {
                  PENDING: "text-ink-muted",
                  SENT: "text-sage-600",
                  FAILED: "text-terracotta-600",
                  CANCELLED: "text-ink-subtle line-through",
                }[j.status];
                return (
                  <div
                    key={j.id}
                    className="flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-ink-soft">
                        {formatDateTime(j.scheduledFor)}
                      </div>
                      {j.error && (
                        <div className="text-terracotta-600 mt-0.5 break-words">
                          {j.error}
                        </div>
                      )}
                    </div>
                    <span className={`shrink-0 ${statusColor}`}>{statusLabel}</span>
                  </div>
                );
              })}
              {!sess.client.phone && !initialNote && (
                <p className="text-ink-subtle pt-2 border-t border-cream-200">
                  התזכורות נשלחות לכתובת האימייל של הלקוח/ה.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

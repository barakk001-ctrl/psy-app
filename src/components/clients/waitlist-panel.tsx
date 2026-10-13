"use client";

import { startTransition, useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Hourglass, MessageCircle, Pencil, Phone, Plus, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  WAITLIST_NAME_MAX,
  WAITLIST_NOTES_MAX,
  WAITLIST_PHONE_MAX,
  telHref,
  whatsappChatHref,
} from "@/lib/waitlist";
import {
  addWaitlistEntryAction,
  deleteWaitlistEntryAction,
  updateWaitlistEntryAction,
  type WaitlistFormState,
} from "@/server/actions/waitlist";

export type WaitlistRow = {
  id: string;
  fullName: string;
  phone: string | null;
  notes: string;
  /** "12.10.26" */
  addedOn: string;
  /** "ממתין/ה 12 ימים" (null on the day of adding) */
  waiting: string | null;
};

/** Add / edit form for one entry. Submits by hand so a refused save keeps what was typed. */
function EntryForm({
  entry,
  onDone,
}: {
  entry?: WaitlistRow;
  onDone: () => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<WaitlistFormState, FormData>(
    entry ? updateWaitlistEntryAction : addWaitlistEntryAction,
    null,
  );
  const fieldErr = state?.fieldErrors ?? {};

  useEffect(() => {
    if (state?.ok) {
      onDone();
      router.refresh();
    }
    // Only react to a new result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const idp = entry ? `wl-${entry.id}-` : "wl-new-";

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        const form = formRef.current;
        if (form) startTransition(() => formAction(new FormData(form)));
      }}
      className="space-y-3"
      noValidate
    >
      {entry && <input type="hidden" name="id" value={entry.id} />}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`${idp}name`}>שם מלא *</Label>
          <Input
            id={`${idp}name`}
            name="fullName"
            required
            maxLength={WAITLIST_NAME_MAX}
            defaultValue={entry?.fullName ?? ""}
            invalid={!!fieldErr.fullName}
            autoFocus={!entry}
          />
          {fieldErr.fullName && (
            <p className="text-xs text-terracotta-600 mt-1">{fieldErr.fullName[0]}</p>
          )}
        </div>
        <div>
          <Label htmlFor={`${idp}phone`}>טלפון ליצירת קשר</Label>
          <Input
            id={`${idp}phone`}
            name="phone"
            type="tel"
            inputMode="tel"
            dir="ltr"
            className="text-right"
            maxLength={WAITLIST_PHONE_MAX}
            defaultValue={entry?.phone ?? ""}
          />
        </div>
      </div>
      <div>
        <Label htmlFor={`${idp}notes`}>הערות</Label>
        <Textarea
          id={`${idp}notes`}
          name="notes"
          rows={2}
          maxLength={WAITLIST_NOTES_MAX}
          defaultValue={entry?.notes ?? ""}
          placeholder="מי הפנה, מה מחפש/ת, זמינות, מתי לחזור אליו/ה…"
        />
      </div>
      {state?.error && (
        <p className="rounded border border-terracotta-500/30 bg-terracotta-500/10 px-3 py-2 text-sm text-terracotta-600">
          {state.error}
        </p>
      )}
      <div className="flex items-center gap-2 justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          ביטול
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "שומר…" : entry ? "שמירה" : "הוספה לרשימה"}
        </Button>
      </div>
    </form>
  );
}

function EntryRow({ entry }: { entry: WaitlistRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startDelete] = useTransition();
  const tel = telHref(entry.phone);
  const wa = whatsappChatHref(entry.phone);

  if (editing) {
    return (
      <li className="px-5 py-4 bg-cream-50/60">
        <EntryForm entry={entry} onDone={() => setEditing(false)} />
      </li>
    );
  }

  const remove = () =>
    startDelete(async () => {
      setError(null);
      try {
        const r = await deleteWaitlistEntryAction(entry.id);
        if (r.error) {
          setError(r.error);
          return;
        }
        router.refresh();
      } catch {
        setError("אין חיבור — נסו שוב.");
      }
    });

  return (
    <li className="px-5 py-4 space-y-2">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="flex-1 min-w-[12rem]">
          <div className="font-medium text-ink">{entry.fullName}</div>
          <div className="text-xs text-ink-muted mt-0.5">
            נוסף/ה ב-{entry.addedOn}
            {entry.waiting && ` · ${entry.waiting}`}
          </div>
        </div>
        {entry.phone && (
          <div className="flex items-center gap-1.5 shrink-0">
            {tel ? (
              <a
                href={tel}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-cream-300 bg-white/70 text-sm text-ink hover:bg-white"
                aria-label={`התקשרות אל ${entry.fullName}`}
              >
                <Phone className="w-4 h-4 text-sage-600" />
                <span dir="ltr">{entry.phone}</span>
              </a>
            ) : (
              <span className="text-sm text-ink-muted" dir="ltr">
                {entry.phone}
              </span>
            )}
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-grid place-items-center h-9 w-9 rounded-xl border border-cream-300 bg-white/70 text-sage-700 hover:bg-white"
                aria-label={`וואטסאפ אל ${entry.fullName}`}
                title="וואטסאפ"
              >
                <MessageCircle className="w-4 h-4" />
              </a>
            )}
          </div>
        )}
      </div>

      {entry.notes && (
        <p className="text-sm text-ink-soft whitespace-pre-wrap break-words">{entry.notes}</p>
      )}

      {confirmDelete ? (
        <div className="rounded-xl border border-terracotta-500/30 bg-terracotta-500/5 px-4 py-3 space-y-2 text-sm">
          <p className="text-ink">להסיר את {entry.fullName} מרשימת ההמתנה?</p>
          {error && <p className="text-terracotta-600">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="danger" disabled={pending} onClick={remove}>
              {pending ? "מסיר…" : "כן, להסיר"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setConfirmDelete(false);
                setError(null);
              }}
            >
              ביטול
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/clients/new?fromWaitlist=${entry.id}`}>
            <Button type="button" size="sm">
              <UserPlus className="w-4 h-4" /> הפיכה ללקוח
            </Button>
          </Link>
          <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="w-4 h-4" /> עריכה
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-terracotta-600"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="w-4 h-4" /> הסרה
          </Button>
        </div>
      )}
    </li>
  );
}

/** The "רשימת המתנה" tab on the clients page. */
export function WaitlistPanel({ entries }: { entries: WaitlistRow[] }) {
  const [adding, setAdding] = useState(entries.length === 0);

  return (
    <Card>
      <div className="px-5 pt-4 pb-3 border-b border-cream-200 space-y-3">
        <p className="text-sm text-ink-muted leading-relaxed">
          פונים שמחכים למקום פנוי. כשמתפנה שעה — ״הפיכה ללקוח״ פותחת תיק חדש עם הפרטים
          שכבר מולאו, והרשומה יורדת מהרשימה.
        </p>
        {adding ? (
          <EntryForm onDone={() => setAdding(false)} />
        ) : (
          <Button type="button" size="sm" onClick={() => setAdding(true)}>
            <Plus className="w-4 h-4" /> הוספה לרשימת ההמתנה
          </Button>
        )}
      </div>
      {entries.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-ink-subtle">
          <Hourglass className="w-10 h-10 mx-auto mb-3 text-ink-subtle" strokeWidth={1.25} />
          אין כרגע אף אחד ברשימת ההמתנה.
        </div>
      ) : (
        <ul className="divide-y divide-cream-200">
          {entries.map((e) => (
            <EntryRow key={e.id} entry={e} />
          ))}
        </ul>
      )}
    </Card>
  );
}

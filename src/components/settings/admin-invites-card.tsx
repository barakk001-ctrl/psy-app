"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { Check, Copy, Ticket } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/format";
import { INVITE_MAX_USES, inviteLink, inviteStatus, type InviteFields, type InviteStatus } from "@/lib/invite-codes";
import {
  createInviteCodeAction,
  revokeInviteCodeAction,
  type InviteFormState,
} from "@/server/actions/invites";

export type AdminInviteRow = InviteFields & {
  id: string;
  code: string;
  note: string | null;
  createdAt: Date;
};

const STATUS_BADGE: Record<InviteStatus, { label: string; cls: string }> = {
  active: { label: "פעיל", cls: "bg-sage-100 text-sage-700" },
  used: { label: "נוצל", cls: "bg-cream-200 text-ink-muted" },
  expired: { label: "פג תוקף", cls: "bg-cream-200 text-ink-muted" },
  revoked: { label: "בוטל", cls: "bg-terracotta-500/15 text-terracotta-600" },
};

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <Button type="button" variant="secondary" size="sm" onClick={copy}>
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      <span className="ms-1">{copied ? "הועתק" : "העתקת קישור"}</span>
    </Button>
  );
}

/** Operator-only: invitation links, so a new user needs no Railway variable. */
export function AdminInvitesCard({ invites, origin }: { invites: AdminInviteRow[]; origin: string }) {
  const [state, formAction, pending] = useActionState<InviteFormState, FormData>(createInviteCodeAction, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.createdCode) form.current?.reset();
  }, [state?.createdCode]);
  // The time of this render, for telling which codes have expired
  const [now] = useState(() => Date.now());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ticket className="w-5 h-5 text-sage-600" />
          הזמנות
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-ink-muted leading-relaxed">
          יוצרים קישור הזמנה ושולחים אותו: מי שמקבל אותו יכול להירשם, גם בזמן שההרשמה סגורה.
        </p>

        <form
          ref={form}
          className="grid gap-3 sm:grid-cols-[1fr_6rem_8rem_auto] sm:items-end"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(() => formAction(fd));
          }}
        >
          <div>
            <Label htmlFor="invite-note">למי (לא חובה)</Label>
            <Input id="invite-note" name="note" maxLength={100} />
          </div>
          <div>
            <Label htmlFor="invite-uses">שימושים</Label>
            <Input id="invite-uses" name="maxUses" type="number" min={1} max={INVITE_MAX_USES} defaultValue={1} />
          </div>
          <div>
            <Label htmlFor="invite-expiry">תוקף</Label>
            <select
              id="invite-expiry"
              name="expiresInDays"
              defaultValue="30"
              className="h-10 w-full rounded-xl border border-cream-300 bg-white/60 px-3 text-sm text-ink"
            >
              <option value="7">שבוע</option>
              <option value="30">30 יום</option>
              <option value="90">90 יום</option>
              <option value="0">ללא הגבלה</option>
            </select>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "יוצר…" : "יצירת הזמנה"}
          </Button>
        </form>
        {state?.error && (
          <div role="alert" className="rounded border border-terracotta-500/30 bg-terracotta-500/10 px-3 py-2 text-sm text-terracotta-600">
            {state.error}
          </div>
        )}

        {invites.length === 0 ? (
          <p className="text-sm text-ink-subtle">עדיין אין הזמנות.</p>
        ) : (
          <ul className="divide-y divide-cream-200">
            {invites.map((inv) => {
              const status = inviteStatus(inv, now);
              const badge = STATUS_BADGE[status];
              return (
                <li key={inv.id} className="py-3 flex flex-wrap items-center gap-2">
                  <div className="flex-1 min-w-44">
                    <div className="text-sm font-medium text-ink">
                      {inv.note || <span className="text-ink-subtle font-normal">ללא הערה</span>}
                    </div>
                    <div className="text-xs text-ink-muted">
                      <span dir="ltr">{inv.code}</span>
                      {" · "}
                      {inv.usedCount} מתוך {inv.maxUses} שימושים
                      {" · "}
                      {inv.expiresAt ? `בתוקף עד ${formatDate(inv.expiresAt)}` : "ללא תאריך תפוגה"}
                    </div>
                  </div>
                  <span className={`text-xs rounded-full px-2.5 py-1 ${badge.cls}`}>{badge.label}</span>
                  {status === "active" && (
                    <>
                      <CopyLink url={inviteLink(origin, inv.code)} />
                      <form
                        action={(fd) => {
                          startTransition(() => {
                            void revokeInviteCodeAction(fd);
                          });
                        }}
                      >
                        <input type="hidden" name="id" value={inv.id} />
                        <Button type="submit" variant="ghost" size="sm">
                          ביטול
                        </Button>
                      </form>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

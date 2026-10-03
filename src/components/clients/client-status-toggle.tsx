"use client";

import { useOptimistic, useState, useTransition } from "react";
import { UserCheck, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  setClientStatusAction,
  type ClientStatusResult,
  type DeactivationConfirm,
} from "@/server/actions/clients";
import { cn } from "@/lib/utils";

type Status = "ACTIVE" | "INACTIVE";

function submit(clientId: string, status: Status, confirmCount?: number) {
  const fd = new FormData();
  fd.set("id", clientId);
  fd.set("status", status);
  if (confirmCount !== undefined) fd.set("confirmDeactivate", String(confirmCount));
  return setClientStatusAction(fd);
}

/**
 * Active → inactive takes the client's future meetings off the calendar, so
 * the server answers the first click with the counts; this asks in-page
 * (never window.confirm) and resubmits with the approved count.
 */
function useStatusChange(clientId: string, onDone?: (r: ClientStatusResult) => void) {
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<DeactivationConfirm | null>(null);

  const run = (next: Status, beforeSubmit?: () => void, confirmCount?: number) => {
    startTransition(async () => {
      beforeSubmit?.();
      const r = await submit(clientId, next, confirmCount);
      if (r && "confirm" in r) {
        setConfirm(r.confirm);
      } else {
        setConfirm(null);
        onDone?.(r);
      }
    });
  };
  return { pending, confirm, setConfirm, run };
}

/** The in-page "are you sure" for marking a client inactive. */
export function DeactivationConfirmPanel({
  confirm,
  pending,
  onConfirm,
  onCancel,
  className,
  confirmLabel = "כן, להעביר ללא פעילים",
  cancelLabel = "ביטול",
}: {
  confirm: DeactivationConfirm;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}) {
  return (
    <div
      role="alertdialog"
      aria-label="העברה ללא פעילים"
      className={cn(
        "rounded-xl border border-terracotta-500/30 bg-terracotta-500/5 px-4 py-3 space-y-2 text-sm text-start",
        className,
      )}
    >
      <p className="font-medium text-ink">להעביר ללא פעילים?</p>
      <p className="text-terracotta-600 font-medium">{confirm.notice}</p>
      <p className="text-xs text-ink-muted">
        פגישות שכבר עברו, סיכומים וחשבוניות נשמרים. החזרה לפעילים לא תחזיר את הפגישות —
        אפשר לקבוע מחדש.
      </p>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button type="button" size="sm" variant="danger" disabled={pending} onClick={onConfirm}>
          {pending ? "מעביר…" : confirmLabel}
        </Button>
        <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={onCancel}>
          {cancelLabel}
        </Button>
      </div>
    </div>
  );
}

/** פעיל / לא פעיל — a two-way switch on the client card. */
export function ClientStatusToggle({
  clientId,
  status,
}: {
  clientId: string;
  status: Status;
}) {
  const [shown, setShown] = useOptimistic(status);
  // After meetings were removed, land on the card's result notice (the same
  // one the bulk delete shows). A full load rather than a client navigation:
  // it always shows the true state, even if the in-page router update stalls.
  const { pending, confirm, setConfirm, run } = useStatusChange(clientId, (r) => {
    if (r && "done" in r && r.result) window.location.assign(`/clients/${clientId}${r.result}`);
  });

  const choose = (next: Status) => {
    if (next === shown || pending) return;
    setConfirm(null);
    run(next, () => setShown(next));
  };

  return (
    <div className="relative inline-flex">
      <div
        role="radiogroup"
        aria-label="סטטוס לקוח/ה"
        className={cn(
          "inline-flex bg-cream-100 border border-cream-300 rounded-full p-1",
          pending && "opacity-70",
        )}
      >
        {(
          [
            ["ACTIVE", "פעיל/ה"],
            ["INACTIVE", "לא פעיל/ה"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={shown === value}
            onClick={() => choose(value)}
            className={cn(
              "px-3.5 py-1 rounded-full text-sm font-medium transition-colors",
              shown === value
                ? value === "ACTIVE"
                  ? "bg-sage-600 text-cream-50 shadow-soft"
                  : "bg-white text-ink shadow-soft"
                : "text-ink-muted hover:text-ink",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {confirm && (
        // A card over the page: under the toggle on a wide screen, above the
        // tab bar on a phone (the header row has no room for it in-flow).
        <div className="fixed inset-x-4 bottom-20 z-50 sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full sm:mt-2 sm:start-0 sm:w-[22rem] rounded-xl bg-cream-50 shadow-lg">
          <DeactivationConfirmPanel
            confirm={confirm}
            pending={pending}
            onConfirm={() => run("INACTIVE", () => setShown("INACTIVE"), confirm.count)}
            onCancel={() => setConfirm(null)}
          />
        </div>
      )}
    </div>
  );
}

/** Small "move to the other tab" button for a row of the clients list. Render
 *  it inside a flex-wrap row: the confirmation takes a full line below it. */
export function ClientStatusMoveButton({
  clientId,
  status,
}: {
  clientId: string;
  status: Status;
}) {
  const { pending, confirm, setConfirm, run } = useStatusChange(clientId);
  const next: Status = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  const label = status === "ACTIVE" ? "העברה ללא פעילים" : "החזרה לפעילים";
  const Icon = status === "ACTIVE" ? UserMinus : UserCheck;
  return (
    <>
      <div className="pe-3 sm:pe-4">
        <button
          type="button"
          title={label}
          aria-label={label}
          disabled={pending || !!confirm}
          onClick={() => run(next)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-ink-muted hover:text-ink hover:bg-cream-200/70 disabled:opacity-50 transition-colors"
        >
          <Icon className="w-4 h-4" />
          <span className="hidden md:inline">{pending ? "מעביר…" : label}</span>
        </button>
      </div>
      {confirm && (
        <div className="basis-full px-4 sm:px-5 pb-4">
          <DeactivationConfirmPanel
            confirm={confirm}
            pending={pending}
            onConfirm={() => run("INACTIVE", undefined, confirm.count)}
            onCancel={() => setConfirm(null)}
          />
        </div>
      )}
    </>
  );
}

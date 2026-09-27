"use client";

import { useOptimistic, useTransition } from "react";
import { UserCheck, UserMinus } from "lucide-react";
import { setClientStatusAction } from "@/server/actions/clients";
import { cn } from "@/lib/utils";

type Status = "ACTIVE" | "INACTIVE";

function submit(clientId: string, status: Status) {
  const fd = new FormData();
  fd.set("id", clientId);
  fd.set("status", status);
  return setClientStatusAction(fd);
}

/** פעיל / לא פעיל — a two-way switch on the client card. */
export function ClientStatusToggle({
  clientId,
  status,
}: {
  clientId: string;
  status: Status;
}) {
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(status);

  const choose = (next: Status) => {
    if (next === shown || pending) return;
    startTransition(async () => {
      setShown(next);
      await submit(clientId, next);
    });
  };

  return (
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
  );
}

/** Small "move to the other tab" button for a row of the clients list. */
export function ClientStatusMoveButton({
  clientId,
  status,
}: {
  clientId: string;
  status: Status;
}) {
  const [pending, startTransition] = useTransition();
  const next: Status = status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  const label = status === "ACTIVE" ? "העברה ללא פעילים" : "החזרה לפעילים";
  const Icon = status === "ACTIVE" ? UserMinus : UserCheck;
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={pending}
      onClick={() => startTransition(() => submit(clientId, next))}
      className="shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-ink-muted hover:text-ink hover:bg-cream-200/70 disabled:opacity-50 transition-colors"
    >
      <Icon className="w-4 h-4" />
      <span className="hidden md:inline">{pending ? "מעביר…" : label}</span>
    </button>
  );
}

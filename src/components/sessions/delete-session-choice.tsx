"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  deleteClientFutureSessionsAction,
  deleteSessionAction,
  type SessionScopeInfo,
} from "@/server/actions/sessions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="danger" size="sm" disabled={pending}>
      {pending ? "מוחק…" : label}
    </Button>
  );
}

/**
 * Delete with an in-page confirmation step: "this meeting only" or "all of
 * this client's future meetings" (for a client who stopped coming). The counts
 * come from the server; the bulk path never touches past meetings or ones
 * holding notes, attachments or billing records.
 */
export function DeleteSessionChoice({
  sessionId,
  clientId,
  info,
  variant = "page",
}: {
  sessionId: string;
  clientId: string;
  /** null while loading (calendar popup) — only "this meeting" is offered then */
  info: SessionScopeInfo | null;
  variant?: "page" | "dialog";
}) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<"single" | "all">("single");

  const offerAll = !!info && info.othersAffected > 0;
  const scope = offerAll ? choice : "single";

  if (!open) {
    return variant === "page" ? (
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-terracotta-600 hover:bg-terracotta-500/10"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="w-4 h-4" />
        מחיקה
      </Button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-terracotta-600 hover:text-terracotta-500"
      >
        מחיקה לצמיתות
      </button>
    );
  }

  const submitLabel =
    scope === "single"
      ? "מחיקת הפגישה"
      : info!.futureDelete > 0
        ? info!.futureDelete === 1
          ? "מחיקת פגישה אחת"
          : `מחיקת ${info!.futureDelete} פגישות`
        : "סימון כמבוטלות";

  return (
    <form
      action={scope === "single" ? deleteSessionAction : deleteClientFutureSessionsAction}
      className={
        "rounded-xl border border-terracotta-500/30 bg-terracotta-500/5 px-4 py-3 space-y-3 text-sm text-start " +
        (variant === "page" ? "w-full sm:w-80" : "")
      }
    >
      <input type="hidden" name="id" value={sessionId} />
      <input type="hidden" name="clientId" value={clientId} />
      <p className="font-medium text-ink">מה למחוק?</p>

      <label className="flex items-start gap-2 text-ink-soft cursor-pointer">
        <input
          type="radio"
          name="deleteScope"
          value="single"
          checked={scope === "single"}
          onChange={() => setChoice("single")}
          className="h-4 w-4 mt-0.5 accent-terracotta-600"
        />
        <span>מחיקת הפגישה הזו בלבד</span>
      </label>

      {offerAll && (
        <label className="flex items-start gap-2 text-ink-soft cursor-pointer">
          <input
            type="radio"
            name="deleteScope"
            value="all"
            checked={scope === "all"}
            onChange={() => setChoice("all")}
            className="h-4 w-4 mt-0.5 accent-terracotta-600"
          />
          <span>מחיקת כל הפגישות העתידיות של {info!.clientName}</span>
        </label>
      )}

      <div className="text-xs text-ink-muted leading-relaxed space-y-1">
        {scope === "single" ? (
          <p>
            הפגישה תימחק לצמיתות, יחד עם הסיכום שלה. כדי לשמור אותה ברשומה — סמנו
            אותה כמבוטלת במקום.
          </p>
        ) : (
          <>
            <p className="text-terracotta-600 font-medium">
              {info!.futureDelete === 0
                ? "אין פגישות עתידיות שאפשר למחוק."
                : info!.futureDelete === 1
                  ? "פגישה עתידית אחת תימחק."
                  : `${info!.futureDelete} פגישות עתידיות יימחקו.`}
            </p>
            {info!.futureKeep > 0 && (
              <p>
                {info!.futureKeep === 1
                  ? `פגישה עתידית אחת תישאר כי יש בה ${info!.keepReasons} — היא תסומן כמבוטלת ולא יישלחו לה תזכורות.`
                  : `${info!.futureKeep} פגישות עתידיות יישארו כי יש בהן ${info!.keepReasons} — הן יסומנו כמבוטלות ולא יישלחו להן תזכורות.`}
              </p>
            )}
            <p>
              פגישות שכבר עברו לא נמחקות לעולם
              {info!.isFuture ? "." : " — גם הפגישה הזו תישאר."}
            </p>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton label={submitLabel} />
        <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>
          חזרה
        </Button>
      </div>
    </form>
  );
}

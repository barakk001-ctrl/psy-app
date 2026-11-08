"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, FileCheck, FileMinus, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { creditNoteAction, recordDocumentNumberAction } from "@/server/actions/documents";
import { IssueComingSoon } from "./issue-coming-soon";

const PANEL = "rounded-2xl border px-4 py-4 space-y-3";

/**
 * A saved draft. The app doesn't issue documents yet: the official one is
 * issued elsewhere (the details are ready to copy) and its number is recorded
 * here, which makes the draft count as issued.
 */
export function DraftDocumentActions({
  invoiceId,
  label,
  copyText,
}: {
  invoiceId: string;
  label: string;
  copyText: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [issueNote, setIssueNote] = useState(false);
  const [copied, setCopied] = useState(false);
  const [number, setNumber] = useState("");

  const saveNumber = () =>
    start(async () => {
      setError(null);
      try {
        const r = await recordDocumentNumberAction(invoiceId, number);
        if (r.error) {
          setError(r.error);
          return;
        }
        // A new address renders the page afresh (a bare refresh was seen not to repaint)
        router.replace(`/invoices/${invoiceId}?recorded=1`);
      } catch {
        setError("אין חיבור — נסו שוב.");
      }
    });

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={`${PANEL} border-cream-300 bg-cream-100`}>
      <p className="text-sm text-ink-soft leading-relaxed">
        <b className="text-ink">טיוטה — עדיין לא מסמך מס.</b> מפיקים את ה{label} במערכת שבה מפיקים
        היום (״העתקת הפרטים״ עוזרת), ורושמים כאן את מספר המסמך שהופק.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={copy}>
          <Copy className="w-4 h-4" /> {copied ? "הועתק ✓" : "העתקת הפרטים"}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setIssueNote(true)}>
          <FileCheck className="w-4 h-4" /> הפקת מסמך
        </Button>
      </div>
      {issueNote && <IssueComingSoon saved onClose={() => setIssueNote(false)} />}

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label htmlFor="doc-issued-number" className="text-xs">
            מספר המסמך שהופק
          </Label>
          <Input
            id="doc-issued-number"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            inputMode="numeric"
            dir="ltr"
            placeholder="20017"
            className="h-9 w-40"
            invalid={!!error}
            aria-describedby={error ? "doc-issued-number-error" : undefined}
          />
        </div>
        <Button type="button" size="sm" onClick={saveNumber} disabled={pending || !number.trim()}>
          {pending ? "שומר…" : "שמירת המספר"}
        </Button>
      </div>
      {error && (
        <p
          id="doc-issued-number-error"
          role="alert"
          className="rounded-lg border border-terracotta-500/30 bg-terracotta-500/10 px-3 py-2 text-sm text-terracotta-600"
        >
          {error}
        </p>
      )}
      <p className="text-xs text-ink-muted">
        אחרי שהמספר נשמר, המסמך נחשב כהופק: הוא נספר בהכנסות ובחובות, והפגישות שסומנו בו
        מקבלות את המספר.
      </p>
    </div>
  );
}

/** An issued tax invoice: a receipt for it (305) and the credit note that cancels it. */
export function IssuedDocumentActions({
  invoiceId,
  canReceipt,
  canCredit,
  label,
}: {
  invoiceId: string;
  canReceipt: boolean;
  canCredit: boolean;
  label: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const credit = () =>
    start(async () => {
      setError(null);
      try {
        const r = await creditNoteAction(invoiceId);
        if (r.error) {
          setError(r.error);
          return;
        }
        if (r.creditNoteId) router.push(`/invoices/${r.creditNoteId}?saved=1`);
      } catch {
        setError("אין חיבור — נסו שוב.");
      }
    });

  if (!canReceipt && !canCredit) return null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {canReceipt && (
          <Link href={`/invoices/new?kind=RECEIPT&forInvoice=${invoiceId}`}>
            <Button type="button" size="sm">
              <Receipt className="w-4 h-4" /> קבלה על החשבונית
            </Button>
          </Link>
        )}
        {canCredit && !confirming && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(true)}>
            <FileMinus className="w-4 h-4" /> ביטול בחשבונית זיכוי
          </Button>
        )}
      </div>
      {confirming && (
        <div className={`${PANEL} border-terracotta-500/30 bg-terracotta-500/5`}>
          <p className="text-sm text-ink">
            תיווצר טיוטת חשבונית זיכוי על מלוא ה{label}. אחרי שמפיקים אותה ורושמים את המספר שלה,
            ה{label} תסומן כאן כמבוטלת והפגישות שבה יחזרו להיות פתוחות לחיוב.
          </p>
          {error && <p role="alert" className="text-sm text-terracotta-600">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="danger" onClick={credit} disabled={pending}>
              {pending ? "יוצר…" : "יצירת טיוטת זיכוי"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
              ביטול
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

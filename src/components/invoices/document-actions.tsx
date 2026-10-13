"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, FileCheck, FileMinus, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  creditNoteAction,
  issueDocumentAction,
  previewStoredInMorningAction,
  setDocumentMorningNumberAction,
} from "@/server/actions/documents";
import { MorningPdfPreview } from "./morning-pdf-link";

const PANEL = "rounded-2xl border px-4 py-4 space-y-3";

/** A saved draft: issue it in morning (connected), or issue it there by hand and record the number. */
export function DraftDocumentActions({
  invoiceId,
  label,
  morningConnected,
  morningUrl,
  copyText,
  initialError,
  uncertain,
}: {
  invoiceId: string;
  label: string;
  morningConnected: boolean;
  /** morning's new-document screen for this type */
  morningUrl: string;
  copyText: string;
  initialError?: string | null;
  uncertain?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [number, setNumber] = useState("");

  const issue = () =>
    start(async () => {
      setError(null);
      try {
        const r = await issueDocumentAction(invoiceId);
        if (!r.ok) {
          setError(r.error);
          setConfirming(false);
          return;
        }
        router.replace(`/invoices/${invoiceId}?issued=1`);
        router.refresh();
      } catch {
        setError("אין חיבור — המסמך לא הופק. נסו שוב.");
      }
    });

  const saveNumber = () =>
    start(async () => {
      setError(null);
      try {
        const r = await setDocumentMorningNumberAction(invoiceId, number);
        if (r.error) {
          setError(r.error);
          return;
        }
        router.refresh();
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
        <b className="text-ink">טיוטה — עדיין לא מסמך מס.</b>{" "}
        {morningConnected
          ? `כשהכול נכון, מפיקים את ה${label} ב-morning: שם הוא מקבל מספר רשמי, והמספר והקישור נשמרים כאן.`
          : `morning לא מחובר: מפיקים את ה${label} ב-morning (״העתקת הפרטים״ ואז ״פתיחה ב-morning״), ורושמים כאן את המספר שהתקבל.`}
      </p>

      {error && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            uncertain
              ? "border border-gold-400 bg-gold-200/40 text-ink"
              : "border border-terracotta-500/30 bg-terracotta-500/10 text-terracotta-600"
          }`}
        >
          {error}
        </p>
      )}

      {morningConnected ? (
        <div className="flex flex-wrap items-start gap-2">
          <MorningPdfPreview load={() => previewStoredInMorningAction(invoiceId)} />
          {confirming ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sage-300 bg-white px-3 py-2">
              <span className="text-sm text-ink">להפיק עכשיו? אחרי ההפקה אי אפשר לערוך.</span>
              <Button type="button" size="sm" onClick={issue} disabled={pending}>
                {pending ? "מפיק…" : "כן, להפיק"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
                ביטול
              </Button>
            </div>
          ) : (
            <Button type="button" size="sm" onClick={() => setConfirming(true)}>
              <FileCheck className="w-4 h-4" /> הפקת {label} ב-morning
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={copy}>
              <Copy className="w-4 h-4" /> {copied ? "הועתק ✓" : "העתקת הפרטים"}
            </Button>
            <a href={morningUrl} target="_blank" rel="noopener noreferrer">
              <Button type="button" size="sm" variant="secondary">
                <ExternalLink className="w-4 h-4" /> פתיחה ב-morning
              </Button>
            </a>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="doc-morning-number" className="text-xs">
                מספר המסמך שהתקבל ב-morning
              </Label>
              <Input
                id="doc-morning-number"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                inputMode="numeric"
                dir="ltr"
                placeholder="20017"
                className="h-9 w-40"
              />
            </div>
            <Button type="button" size="sm" onClick={saveNumber} disabled={pending || !number.trim()}>
              {pending ? "שומר…" : "שמירת המספר"}
            </Button>
          </div>
          <p className="text-xs text-ink-muted">
            רוצים שהמסמך יופק מכאן אוטומטית? מחברים את morning ב
            <Link href="/settings" className="text-sage-600 hover:underline">
              הגדרות
            </Link>
            .
          </p>
        </>
      )}
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
        if (r.creditNoteId) {
          const q = r.issue?.ok ? "issued=1" : `issueError=${encodeURIComponent(r.issue?.error ?? "")}`;
          router.push(`/invoices/${r.creditNoteId}?${q}`);
        }
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
            תופק ב-morning חשבונית זיכוי על מלוא ה{label}, והיא תסומן כאן כמבוטלת. הפגישות שבה
            יחזרו להיות פתוחות לחיוב.
          </p>
          {error && <p className="text-sm text-terracotta-600">{error}</p>}
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="danger" onClick={credit} disabled={pending}>
              {pending ? "מפיק…" : "כן, להפיק חשבונית זיכוי"}
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

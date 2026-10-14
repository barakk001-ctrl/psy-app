"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Eye, FileCheck, Plus, Save, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  CARD_TYPES,
  CARD_TYPE_LABELS,
  DEAL_TYPES,
  DEAL_TYPE_LABELS,
  DOC_KINDS,
  PAYMENT_DETAIL_FIELDS,
  PAYMENT_DETAIL_LABELS,
  PAYMENT_KINDS,
  PAYMENT_KIND_LABELS,
  agorotToDecimalString,
  documentProblems,
  documentTotals,
  lineAgorot,
  morningCopyText,
  morningNewDocumentUrl,
  parseAgorot,
  type DocKind,
  type DocumentDraft,
  type PaymentDetailField,
  type PaymentKind,
} from "@/lib/billing-docs";
import { saveDocumentAction, previewDraftInMorningAction } from "@/server/actions/documents";
import { DocumentPreview, type PreviewBusiness } from "./document-preview";
import { MorningPdfPreview } from "./morning-pdf-link";

export type DocClientOption = {
  id: string;
  name: string;
  idNumber: string | null;
  email: string | null;
  rate: string | null;
};

export type DocSessionOption = {
  id: string;
  clientId: string;
  /** "12.10.26 · טיפול פרטני" */
  label: string;
  /** "12.10.26" */
  day: string;
  rate: string | null;
};

type ItemRow = { key: string; description: string; quantity: string; unitPrice: string; sessionId?: string };
type PaymentRow = {
  key: string;
  method: PaymentKind;
  date: string;
  amount: string;
  /** follows the document total until she types an amount */
  autoAmount: boolean;
} & Partial<Record<PaymentDetailField, string>>;

let keySeq = 0;
const nextKey = () => `r${++keySeq}`;

const ils = (agorot: number) =>
  `₪${Number(agorotToDecimalString(agorot)).toLocaleString("he-IL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function DocumentForm({
  kinds,
  initialKind,
  clients,
  sessions,
  business,
  morningConnected,
  today,
  initial,
}: {
  kinds: DocKind[];
  initialKind: DocKind;
  clients: DocClientOption[];
  sessions: DocSessionOption[];
  business: PreviewBusiness;
  morningConnected: boolean;
  /** yyyy-mm-dd on the clinic calendar */
  today: string;
  initial?: {
    clientId?: string;
    sessionIds?: string[];
    /** a receipt for this tax invoice */
    relatedInvoice?: { id: string; label: string; balance: string };
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const related = initial?.relatedInvoice;

  const [kind, setKind] = useState<DocKind>(related ? "RECEIPT" : initialKind);
  const info = DOC_KINDS[kind];
  const [clientId, setClientId] = useState(initial?.clientId ?? "");
  const client = clients.find((c) => c.id === clientId);
  const [clientName, setClientName] = useState(client?.name ?? "");
  const [clientTaxId, setClientTaxId] = useState(client?.idNumber ?? "");
  const [sendEmail, setSendEmail] = useState(false);
  const [clientEmail, setClientEmail] = useState(client?.email ?? "");
  const [date, setDate] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [vatIncluded, setVatIncluded] = useState(true);
  const [description, setDescription] = useState(related ? `קבלה עבור ${related.label}` : "");
  const [remarks, setRemarks] = useState("");

  const sessionRow = (s: DocSessionOption): ItemRow => ({
    key: nextKey(),
    description: `פגישה ${s.day}`,
    quantity: "1",
    unitPrice: s.rate ?? client?.rate ?? "",
    sessionId: s.id,
  });
  const [items, setItems] = useState<ItemRow[]>(() =>
    sessions.filter((s) => initial?.sessionIds?.includes(s.id)).map(sessionRow),
  );
  const [payments, setPayments] = useState<PaymentRow[]>(() => [
    {
      key: nextKey(),
      method: "BIT",
      date: today,
      amount: related ? related.balance : "",
      autoAmount: !related,
    },
  ]);

  const [showPreview, setShowPreview] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const clientSessions = sessions.filter((s) => s.clientId === clientId);
  const pickedSessions = new Set(items.map((i) => i.sessionId).filter(Boolean));

  // The draft as the rules (and morning) see it
  const draft: DocumentDraft = useMemo(
    () => ({
      kind,
      clientName,
      clientTaxId: clientTaxId || null,
      clientEmail: sendEmail ? clientEmail || null : null,
      date,
      dueDate: info.hasDueDate ? dueDate || null : null,
      vatIncluded,
      description: description || null,
      remarks: remarks || null,
      items: items
        .filter((it) => info.hasItems || it.sessionId)
        .map((it) => ({
          description: it.description,
          quantity: Number(it.quantity) || 0,
          unitPriceAgorot: parseAgorot(it.unitPrice) ?? 0,
          sessionId: it.sessionId ?? null,
        })),
      payments: info.hasPayments
        ? payments.map((p) => ({
            method: p.method,
            date: p.date,
            amountAgorot: parseAgorot(p.amount) ?? 0,
            bankName: p.bankName || null,
            bankBranch: p.bankBranch || null,
            bankAccount: p.bankAccount || null,
            chequeNumber: p.chequeNumber || null,
            cardType: (p.cardType || null) as DocumentDraft["payments"][number]["cardType"],
            cardLast4: p.cardLast4 || null,
            dealType: (p.dealType || null) as DocumentDraft["payments"][number]["dealType"],
            installments: p.installments ? Number(p.installments) : null,
            reference: p.reference || null,
          }))
        : [],
    }),
    [kind, info, clientName, clientTaxId, sendEmail, clientEmail, date, dueDate, vatIncluded, description, remarks, items, payments],
  );
  const totals = documentTotals(draft, business.vatLiable);
  // What the receipt lines should add up to: the invoice total, or (receipt)
  // the meetings it covers
  const targetAgorot = info.hasItems
    ? totals.totalAgorot
    : draft.items.reduce((s, it) => s + lineAgorot(it), 0);

  // A single auto receipt line follows the total
  const shownPayments = payments.map((p, i) =>
    p.autoAmount && payments.length === 1 && i === 0 && targetAgorot > 0
      ? { ...p, amount: agorotToDecimalString(targetAgorot) }
      : p,
  );

  function pickClient(id: string) {
    const c = clients.find((x) => x.id === id);
    setClientId(id);
    setClientName(c?.name ?? "");
    setClientTaxId(c?.idNumber ?? "");
    setClientEmail(c?.email ?? "");
    setSendEmail(false);
    setItems((prev) => prev.filter((it) => !it.sessionId));
  }

  function toggleSession(s: DocSessionOption) {
    setItems((prev) =>
      prev.some((it) => it.sessionId === s.id)
        ? prev.filter((it) => it.sessionId !== s.id)
        : [...prev, sessionRow(s)],
    );
  }

  const updateItem = (key: string, patch: Partial<ItemRow>) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  const updatePayment = (key: string, patch: Partial<PaymentRow>) =>
    setPayments((prev) =>
      prev.map((p, i) => {
        if (p.key !== key) return p;
        // Freeze the auto amount at what was shown before editing anything else
        const base = { ...p, amount: shownPayments[i].amount };
        return { ...base, ...patch };
      }),
    );

  function submittable(): DocumentDraft {
    return { ...draft, payments: info.hasPayments ? draftPaymentsFrom(shownPayments, draft) : [] };
  }

  function openPreview() {
    setServerError(null);
    const d = submittable();
    const found = clientId ? documentProblems(d, business.vatLiable) : ["יש לבחור לקוח/ה.", ...documentProblems(d, business.vatLiable)];
    setProblems(found);
    if (found.length === 0) {
      setShowPreview(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function payloadJson(): string {
    const d = submittable();
    return JSON.stringify({
      kind,
      clientId,
      clientName: d.clientName,
      clientTaxId: d.clientTaxId ?? "",
      clientEmail: d.clientEmail ?? "",
      date: d.date,
      dueDate: d.dueDate ?? "",
      vatIncluded: d.vatIncluded,
      description: d.description ?? "",
      remarks: d.remarks ?? "",
      relatedInvoiceId: related?.id ?? "",
      items: d.items.map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unitPrice: agorotToDecimalString(it.unitPriceAgorot),
        sessionId: it.sessionId ?? "",
      })),
      payments: d.payments.map((p) => ({
        method: p.method,
        date: p.date,
        amount: agorotToDecimalString(p.amountAgorot),
        bankName: p.bankName ?? "",
        bankBranch: p.bankBranch ?? "",
        bankAccount: p.bankAccount ?? "",
        chequeNumber: p.chequeNumber ?? "",
        cardType: p.cardType ?? "",
        cardLast4: p.cardLast4 ?? "",
        dealType: p.dealType ?? "",
        installments: p.installments ?? "",
        reference: p.reference ?? "",
      })),
    });
  }

  function save(intent: "draft" | "issue") {
    setServerError(null);
    startTransition(async () => {
      try {
        const r = await saveDocumentAction(payloadJson(), intent);
        if (!r.invoiceId) {
          setShowPreview(false);
          setServerError(r.error ?? "השמירה נכשלה.");
          setProblems(r.problems ?? []);
          return;
        }
        const q = !r.issue
          ? "saved=1"
          : r.issue.ok
            ? "issued=1"
            : `issueError=${encodeURIComponent(r.issue.error)}${r.issue.uncertain ? "&uncertain=1" : ""}`;
        router.push(`/invoices/${r.invoiceId}?${q}`);
      } catch {
        setServerError("אין חיבור — המסמך לא נשמר. נסו שוב.");
      }
    });
  }

  async function copyDetails() {
    try {
      await navigator.clipboard.writeText(morningCopyText(submittable(), business.vatLiable));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  // ── Preview step ──────────────────────────────────────────────────────────
  if (showPreview) {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-sage-100 bg-sage-50 px-4 py-3 text-sm text-sage-700 leading-relaxed">
          {morningConnected ? (
            <>
              כך ייראה המסמך. <b>״הפקת {info.label} ב-morning״</b> מפיקה אותו שם — מסמך רשמי עם
              מספר — והמספר והקישור נשמרים כאן. אחרי ההפקה אי אפשר לערוך אותו, רק לבטל.
            </>
          ) : (
            <>
              כך ייראה המסמך. morning לא מחובר, אז המסמך יישמר כאן כטיוטה (לא מסמך מס) ומפיקים
              אותו ב-morning: ״העתקת הפרטים״ ואז ״פתיחה ב-morning״.
            </>
          )}
        </div>

        <DocumentPreview draft={submittable()} business={business} status="draft" />

        {serverError && <p className="text-sm text-terracotta-600">{serverError}</p>}

        <div className="flex flex-wrap items-start gap-2 justify-between">
          <Button type="button" variant="ghost" onClick={() => setShowPreview(false)} disabled={pending}>
            חזרה לעריכה
          </Button>
          <div className="flex flex-wrap items-start gap-2">
            {morningConnected ? (
              <>
                <MorningPdfPreview load={() => previewDraftInMorningAction(payloadJson())} />
                <Button type="button" variant="secondary" onClick={() => save("draft")} disabled={pending}>
                  <Save className="w-4 h-4" /> שמירה כטיוטה
                </Button>
                <Button type="button" onClick={() => save("issue")} disabled={pending}>
                  <FileCheck className="w-4 h-4" />
                  {pending ? "מפיק ב-morning…" : `הפקת ${info.label} ב-morning`}
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="secondary" onClick={copyDetails}>
                  <Copy className="w-4 h-4" /> {copied ? "הועתק ✓" : "העתקת הפרטים"}
                </Button>
                <a href={morningNewDocumentUrl(kind)} target="_blank" rel="noopener noreferrer">
                  <Button type="button" variant="secondary">
                    <ExternalLink className="w-4 h-4" /> פתיחה ב-morning
                  </Button>
                </a>
                <Button type="button" onClick={() => save("draft")} disabled={pending}>
                  <Save className="w-4 h-4" /> {pending ? "שומר…" : "שמירה כטיוטה"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        openPreview();
      }}
    >
      {related ? (
        <div className="rounded-2xl border border-cream-300 bg-cream-100 px-4 py-3 text-sm text-ink-soft">
          קבלה על <b>{related.label}</b>. כשהקבלה תופק ב-morning, החשבונית תיסגר שם.
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>סוג המסמך</CardTitle>
          </CardHeader>
          <CardContent>
            <div role="radiogroup" className="grid sm:grid-cols-3 gap-2">
              {kinds.map((k) => {
                const ki = DOC_KINDS[k];
                return (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={kind === k}
                    onClick={() => setKind(k)}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-start transition-colors",
                      kind === k
                        ? "border-sage-500 bg-sage-50 ring-2 ring-sage-500/20"
                        : "border-cream-300 bg-white/60 hover:bg-white",
                    )}
                  >
                    <div className="font-medium text-ink text-sm">{ki.label}</div>
                    <div className="text-xs text-ink-muted mt-0.5 leading-snug">{ki.hint}</div>
                  </button>
                );
              })}
            </div>
            {kinds.length === 1 && (
              <p className="text-xs text-ink-muted mt-2">
                בהגדרות העסק מסומן עוסק פטור, ולכן מפיקים קבלות. עוסק מורשה? מסמנים זאת ב״פרטי
                העסק״ ואז מופיעות גם חשבונית מס וחשבונית מס/קבלה.
              </p>
            )}
            {business.vatLiable && (
              <p className="text-xs text-ink-muted mt-2">
                חשבונית זיכוי מפיקים מתוך החשבונית שמבטלים — בעמוד שלה, ״ביטול בחשבונית זיכוי״.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>פרטי המסמך</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="doc-client">לקוח/ה *</Label>
            <Select
              id="doc-client"
              value={clientId}
              disabled={!!related}
              onChange={(e) => pickClient(e.target.value)}
            >
              <option value="" disabled>
                בחר/י לקוח/ה
              </option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          {clientId && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="doc-name">שם על המסמך *</Label>
                <Input id="doc-name" value={clientName} onChange={(e) => setClientName(e.target.value)} maxLength={120} />
              </div>
              <div>
                <Label htmlFor="doc-taxid">ת״ז / ח״פ</Label>
                <Input
                  id="doc-taxid"
                  value={clientTaxId}
                  onChange={(e) => setClientTaxId(e.target.value)}
                  inputMode="numeric"
                  dir="ltr"
                  className="text-right"
                  maxLength={20}
                />
              </div>
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="doc-date">תאריך המסמך *</Label>
              <Input id="doc-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            {info.hasDueDate && (
              <div>
                <Label htmlFor="doc-due">לתשלום עד</Label>
                <Input id="doc-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            )}
          </div>
          {!info.hasItems && (
            <div>
              <Label htmlFor="doc-desc">תיאור תכולת המסמך</Label>
              <Input
                id="doc-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="למשל: טיפולים בחודש אוקטובר"
                maxLength={300}
              />
            </div>
          )}
          {morningConnected && clientId && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="h-4 w-4 accent-sage-600"
                />
                ש-morning ישלח ללקוח/ה את המסמך במייל
              </label>
              {sendEmail && (
                <Input
                  type="email"
                  dir="ltr"
                  className="text-right"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="כתובת המייל של הלקוח/ה"
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {clientId && (
        <Card>
          <CardHeader>
            <CardTitle>{info.hasItems ? "פירוט הכנסות" : "הפגישות שהקבלה עבורן"}</CardTitle>
            <p className="text-xs text-ink-muted mt-1">
              {info.hasItems
                ? "מסמנים פגישות שהתקיימו ועוד לא חויבו, או מוסיפים שורה. מטבע: ₪ (שקל)."
                : "לא חובה — הקבלה עצמה מציגה רק את התקבולים, אבל כך הפגישות מסומנות כמחויבות ומספר הקבלה נרשם בהן."}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {clientSessions.length > 0 ? (
              <ul className="divide-y divide-cream-200 -mx-5 -mt-5 border-b border-cream-200">
                {clientSessions.map((s) => (
                  <li key={s.id}>
                    <label className="flex items-center gap-3 px-5 py-2.5 cursor-pointer hover:bg-cream-100/60">
                      <input
                        type="checkbox"
                        checked={pickedSessions.has(s.id)}
                        onChange={() => toggleSession(s)}
                        className="w-4 h-4 accent-sage-600"
                      />
                      <span className="flex-1 text-sm text-ink">{s.label}</span>
                      {s.rate && <span className="text-sm text-ink-muted">₪{Number(s.rate)}</span>}
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">אין פגישות שהתקיימו ועוד לא חויבו.</p>
            )}

            {info.hasItems && (
              <>
                {items.length > 0 && (
                  <div className="space-y-2">
                    {items.map((it) => (
                      <div key={it.key} className="grid grid-cols-12 gap-2 items-end rounded-xl bg-cream-100 p-2.5">
                        <div className="col-span-12 sm:col-span-6">
                          <Label className="text-xs">תיאור</Label>
                          <Input
                            value={it.description}
                            onChange={(e) => updateItem(it.key, { description: e.target.value })}
                            maxLength={200}
                            className="h-10"
                          />
                        </div>
                        <div className="col-span-3 sm:col-span-2">
                          <Label className="text-xs">כמות</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            inputMode="decimal"
                            value={it.quantity}
                            onChange={(e) => updateItem(it.key, { quantity: e.target.value })}
                            className="h-10"
                          />
                        </div>
                        <div className="col-span-7 sm:col-span-3">
                          <Label className="text-xs">מחיר (₪)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={it.unitPrice}
                            onChange={(e) => updateItem(it.key, { unitPrice: e.target.value })}
                            className="h-10"
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-1 flex justify-center pb-2">
                          <button
                            type="button"
                            onClick={() => setItems((prev) => prev.filter((x) => x.key !== it.key))}
                            className="text-ink-muted hover:text-terracotta-500 p-1"
                            aria-label="הסרת השורה"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setItems((prev) => [
                      ...prev,
                      { key: nextKey(), description: "", quantity: "1", unitPrice: client?.rate ?? "" },
                    ])
                  }
                >
                  <Plus className="w-4 h-4" /> הוספת שורה
                </Button>
                {business.vatLiable && (
                  <div className="inline-flex rounded-full border border-cream-300 bg-cream-100 p-1 text-sm">
                    {[
                      { v: true, label: "המחירים כוללים מע״מ" },
                      { v: false, label: "לא כוללים מע״מ" },
                    ].map((o) => (
                      <button
                        key={String(o.v)}
                        type="button"
                        onClick={() => setVatIncluded(o.v)}
                        className={cn(
                          "px-3 py-1 rounded-full",
                          vatIncluded === o.v ? "bg-white text-ink shadow-soft" : "text-ink-muted",
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="ms-auto max-w-xs space-y-1 text-sm">
                  {business.vatLiable && (
                    <>
                      <div className="flex justify-between text-ink-muted">
                        <span>לפני מע״מ</span>
                        <span>{ils(totals.netAgorot)}</span>
                      </div>
                      <div className="flex justify-between text-ink-muted">
                        <span>מע״מ {totals.vatPercent}%</span>
                        <span>{ils(totals.vatAgorot)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between font-semibold text-ink border-t border-cream-300 pt-1">
                    <span>סה״כ</span>
                    <span>{ils(totals.totalAgorot)}</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {clientId && info.hasPayments && (
        <Card>
          <CardHeader>
            <CardTitle>פירוט תקבולים</CardTitle>
            <p className="text-xs text-ink-muted mt-1">
              איך שילמו? אפשר כמה תקבולים, למשל חלק בביט וחלק במזומן.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {shownPayments.map((p, idx) => (
              <div key={p.key} className="rounded-xl bg-cream-100 p-3 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end">
                  <div className="col-span-2 sm:col-span-4">
                    <Label className="text-xs">אמצעי תשלום</Label>
                    <Select
                      value={p.method}
                      onChange={(e) => updatePayment(p.key, { method: e.target.value as PaymentKind })}
                      className="h-10"
                    >
                      {PAYMENT_KINDS.map((m) => (
                        <option key={m} value={m}>
                          {PAYMENT_KIND_LABELS[m]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="sm:col-span-4">
                    <Label className="text-xs">תאריך</Label>
                    <Input
                      type="date"
                      value={p.date}
                      onChange={(e) => updatePayment(p.key, { date: e.target.value })}
                      className="h-10"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Label className="text-xs">סכום (₪)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={p.amount}
                      onChange={(e) => updatePayment(p.key, { amount: e.target.value, autoAmount: false })}
                      className="h-10"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex justify-center pb-2">
                    {shownPayments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setPayments((prev) => prev.filter((x) => x.key !== p.key))}
                        className="text-ink-muted hover:text-terracotta-500 p-1"
                        aria-label={`הסרת תקבול ${idx + 1}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                {PAYMENT_DETAIL_FIELDS[p.method].length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {PAYMENT_DETAIL_FIELDS[p.method].map((f) => (
                      <div key={f}>
                        <Label className="text-xs">
                          {PAYMENT_DETAIL_LABELS[f]}
                          {p.method === "CHECK" && f !== "reference" ? " *" : ""}
                        </Label>
                        {f === "cardType" || f === "dealType" ? (
                          <Select
                            value={p[f] ?? ""}
                            onChange={(e) => updatePayment(p.key, { [f]: e.target.value })}
                            className="h-10"
                          >
                            <option value="">—</option>
                            {(f === "cardType" ? CARD_TYPES : DEAL_TYPES).map((v) => (
                              <option key={v} value={v}>
                                {f === "cardType"
                                  ? CARD_TYPE_LABELS[v as (typeof CARD_TYPES)[number]]
                                  : DEAL_TYPE_LABELS[v as (typeof DEAL_TYPES)[number]]}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <Input
                            value={p[f] ?? ""}
                            onChange={(e) => updatePayment(p.key, { [f]: e.target.value })}
                            inputMode={f === "bankName" || f === "reference" ? "text" : "numeric"}
                            maxLength={f === "cardLast4" ? 4 : f === "installments" ? 2 : 60}
                            dir={f === "bankName" ? undefined : "ltr"}
                            className="h-10 text-right"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setPayments((prev) => [
                  ...prev.map((x, i) => ({ ...x, amount: shownPayments[i].amount, autoAmount: false })),
                  { key: nextKey(), method: "CASH", date: today, amount: "", autoAmount: false },
                ])
              }
            >
              <Plus className="w-4 h-4" /> הוספת תקבול
            </Button>
            <div className="flex justify-between text-sm max-w-xs ms-auto">
              <span className="text-ink-muted">סה״כ תקבולים</span>
              <span className="font-semibold text-ink">
                {ils(shownPayments.reduce((s, p) => s + (parseAgorot(p.amount) ?? 0), 0))}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {clientId && (
        <Card>
          <CardContent className="space-y-2">
            <Label htmlFor="doc-remarks">הערות שיופיעו במסמך</Label>
            <Textarea
              id="doc-remarks"
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              maxLength={1000}
              placeholder="לא חובה"
            />
          </CardContent>
        </Card>
      )}

      {(problems.length > 0 || serverError) && (
        <div className="rounded-xl border border-terracotta-500/30 bg-terracotta-500/10 px-4 py-3 text-sm text-terracotta-600 space-y-1">
          {serverError && <p className="font-medium">{serverError}</p>}
          {problems.length > 0 && (
            <ul className="list-disc ps-5 space-y-0.5">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 justify-end">
        <Link href="/invoices">
          <Button type="button" variant="ghost">
            ביטול
          </Button>
        </Link>
        <Button type="submit">
          <Eye className="w-4 h-4" /> תצוגה מקדימה
        </Button>
      </div>
    </form>
  );
}

/** The receipt lines as shown (a single auto line carries the current total). */
function draftPaymentsFrom(rows: PaymentRow[], draft: DocumentDraft): DocumentDraft["payments"] {
  return rows.map((p, i) => ({ ...draft.payments[i], amountAgorot: parseAgorot(p.amount) ?? 0 }));
}

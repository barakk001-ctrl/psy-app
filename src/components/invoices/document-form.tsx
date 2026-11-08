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
  DOC_CURRENCIES,
  DOC_CURRENCY_LABELS,
  DOC_KINDS,
  DOC_LANGS,
  DOC_LANG_LABELS,
  DOC_ROUNDING_LABELS,
  DOC_VAT_TYPES,
  DOC_VAT_TYPE_LABELS,
  MANUAL_ONLY_PAYMENT_KINDS,
  PAYMENT_DETAIL_FIELDS,
  PAYMENT_KINDS,
  PAYMENT_KIND_LABELS,
  agorotToDecimalString,
  documentProblems,
  documentTotals,
  morningPaymentProblems,
  formatDocMoney,
  lastDayOfMonth,
  morningCopyText,
  morningNewDocumentUrl,
  parseAgorot,
  paymentDetailLabel,
  type DocCurrency,
  type DocKind,
  type DocLang,
  type DocVatType,
  type DocumentDefaults,
  type DocumentDraft,
  type PaymentDetailField,
  type PaymentKind,
} from "@/lib/billing-docs";
import { saveDocumentAction, previewDraftInMorningAction } from "@/server/actions/documents";
import { DocKindSquares } from "./doc-kind-squares";
import { DocumentPreview, type PreviewBusiness } from "./document-preview";
import { IssueConfirmDialog, type IssueSummary } from "./issue-confirm-dialog";
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

type ItemRow = { key: string; description: string; quantity: string; unitPrice: string };
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

/** An issued invoice a credit note can cancel, with what the form fills in from it. */
export type CreditableInvoice = {
  id: string;
  /** "חשבונית מס 20345 · מיכל אברהם" */
  label: string;
  clientId: string | null;
  clientName: string;
  clientTaxId: string | null;
  currency: string;
  vatIncluded: boolean;
  items: { description: string; quantity: string; unitPrice: string }[];
};

/** The select's value for a client who isn't on the list. */
const ONE_OFF = "one-off";

export function DocumentForm({
  initialKind,
  defaults,
  creditableInvoices,
  clients,
  sessions,
  business,
  morningConnected,
  today,
  initial,
}: {
  initialKind: DocKind;
  defaults: DocumentDefaults;
  creditableInvoices: CreditableInvoice[];
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
    /** the printed details when that invoice's client is one-off */
    oneOffName?: string;
    oneOffTaxId?: string;
    /** the invoice's currency, for a receipt on it */
    currency?: string;
    /** the saved draft being edited */
    stored?: { id: string; clientId: string | null; relatedInvoiceId: string | null; draft: DocumentDraft };
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const related = initial?.relatedInvoice;

  const [kind, setKind] = useState<DocKind>(related ? "RECEIPT" : initialKind);
  const info = DOC_KINDS[kind];
  const stored = initial?.stored;
  const storedDraft = stored?.draft;
  const [clientId, setClientId] = useState(stored ? (stored.clientId ?? "") : (initial?.clientId ?? ""));
  const client = clients.find((c) => c.id === clientId);
  // A saved draft with a name and no client is a one-off client's
  const [oneOff, setOneOff] = useState(
    !!initial?.oneOffName || (!!storedDraft?.clientName && !stored?.clientId),
  );
  const [clientName, setClientName] = useState(
    storedDraft?.clientName ?? initial?.oneOffName ?? client?.name ?? "",
  );
  const [clientTaxId, setClientTaxId] = useState(
    storedDraft ? (storedDraft.clientTaxId ?? "") : (initial?.oneOffTaxId ?? client?.idNumber ?? ""),
  );
  const [emails, setEmails] = useState<string[]>(
    storedDraft ? (storedDraft.clientEmails ?? []) : client?.email ? [client.email] : [],
  );
  const [date, setDate] = useState(storedDraft?.date ?? today);
  const [dueDate, setDueDate] = useState(storedDraft?.dueDate ?? lastDayOfMonth(today));
  const [vatIncluded, setVatIncluded] = useState(storedDraft?.vatIncluded ?? true);
  // The settings bar: from Settings, or what the draft was saved with
  const [currency, setCurrency] = useState<DocCurrency>(
    (storedDraft?.currency ?? initial?.currency ?? defaults.currency) as DocCurrency,
  );
  const [lang, setLang] = useState<DocLang>((storedDraft?.lang as DocLang) ?? defaults.lang);
  const [vatType, setVatType] = useState<DocVatType>(
    business.vatLiable ? ((storedDraft?.vatType as DocVatType) ?? defaults.vatType) : 0,
  );
  const [rounding, setRounding] = useState(storedDraft?.rounding ?? defaults.rounding);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // A credit note's optional link to the document it cancels
  const [creditOf, setCreditOf] = useState(stored?.relatedInvoiceId ?? "");
  const [description, setDescription] = useState(
    storedDraft?.description ?? (related ? `קבלה עבור ${related.label}` : ""),
  );
  const [remarks, setRemarks] = useState(storedDraft?.remarks ?? "");

  const emptyItem = (rate?: string | null): ItemRow => ({
    key: nextKey(),
    description: "",
    quantity: "1",
    unitPrice: rate ?? "",
  });
  // Every field is open from the start, so there is always a line to fill in
  const [items, setItems] = useState<ItemRow[]>(() => {
    const rows = storedDraft?.items.map((it) => ({
      key: nextKey(),
      description: it.description,
      quantity: String(it.quantity),
      unitPrice: agorotToDecimalString(it.unitPriceAgorot),
    }));
    return rows?.length ? rows : [emptyItem(client?.rate)];
  });
  const [sessionIds, setSessionIds] = useState<string[]>(
    storedDraft?.sessionIds ?? initial?.sessionIds ?? [],
  );
  const [payments, setPayments] = useState<PaymentRow[]>(() =>
    storedDraft?.payments.length
      ? storedDraft.payments.map((p) => ({
          ...p,
          key: nextKey(),
          amount: agorotToDecimalString(p.amountAgorot),
          autoAmount: false,
          cardType: p.cardType ?? undefined,
          dealType: p.dealType ?? undefined,
          bankName: p.bankName ?? undefined,
          bankBranch: p.bankBranch ?? undefined,
          bankAccount: p.bankAccount ?? undefined,
          chequeNumber: p.chequeNumber ?? undefined,
          cardLast4: p.cardLast4 ?? undefined,
          reference: p.reference ?? undefined,
          details: p.details ?? undefined,
          installments: p.installments != null ? String(p.installments) : undefined,
        }))
      : [
          {
            key: nextKey(),
            method: "BIT",
            date: today,
            amount: related ? related.balance : "",
            autoAmount: !related,
          },
        ],
  );

  const [showPreview, setShowPreview] = useState(false);
  const [confirmIssue, setConfirmIssue] = useState<IssueSummary | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const clientSessions = sessions.filter((s) => s.clientId === clientId);
  const linked = kind === "CREDIT_NOTE" && !!creditOf;
  const money = (agorot: number) => formatDocMoney(agorot, currency);

  // The draft as the rules (and morning) see it
  const draft: DocumentDraft = useMemo(
    () => ({
      kind,
      clientName,
      clientTaxId: clientTaxId || null,
      clientEmails: emails.map((e) => e.trim()).filter(Boolean),
      date,
      dueDate: info.hasDueDate ? dueDate || null : null,
      vatIncluded,
      currency,
      lang,
      vatType,
      rounding,
      sessionIds: info.hasSessions && clientId ? sessionIds : [],
      description: description || null,
      remarks: remarks || null,
      items: info.hasItems
        ? items.map((it) => ({
            description: it.description,
            quantity: Number(it.quantity) || 0,
            unitPriceAgorot: parseAgorot(it.unitPrice) ?? 0,
          }))
        : [],
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
            details: p.method === "OTHER" ? p.details || null : null,
          }))
        : [],
    }),
    [kind, info, clientId, clientName, clientTaxId, emails, date, dueDate, vatIncluded, currency, lang, vatType, rounding, sessionIds, description, remarks, items, payments],
  );
  const totals = documentTotals(draft, business.vatLiable);
  // What the receipt lines should add up to (a receipt has no total of its own)
  const targetAgorot = info.hasItems ? totals.totalAgorot : 0;

  // A single auto receipt line follows the total
  const shownPayments = payments.map((p, i) =>
    p.autoAmount && payments.length === 1 && i === 0 && targetAgorot > 0
      ? { ...p, amount: agorotToDecimalString(targetAgorot) }
      : p,
  );

  const receivedAgorot = shownPayments.reduce((s, p) => s + (parseAgorot(p.amount) ?? 0), 0);
  const receiptsOff = info.hasPayments && receivedAgorot !== totals.totalAgorot;

  function pickClient(value: string) {
    const c = clients.find((x) => x.id === value);
    setOneOff(value === ONE_OFF);
    setClientId(c?.id ?? "");
    setClientName(c?.name ?? "");
    setClientTaxId(c?.idNumber ?? "");
    setEmails(c?.email ? [c.email] : []);
    setSessionIds([]);
    // A rate typed for the previous client shouldn't follow the next one
    setItems((prev) =>
      prev.length === 1 && !prev[0].description ? [emptyItem(c?.rate)] : prev,
    );
  }

  /** Linking a document fills in its client and lines: the credit cancels all of it. */
  function pickOriginal(id: string) {
    setCreditOf(id);
    const orig = creditableInvoices.find((i) => i.id === id);
    if (!orig) return;
    setClientId(orig.clientId ?? "");
    setOneOff(!orig.clientId);
    setClientName(orig.clientName);
    setClientTaxId(orig.clientTaxId ?? "");
    setCurrency(orig.currency as DocCurrency);
    setVatIncluded(orig.vatIncluded);
    setItems(orig.items.map((it) => ({ key: nextKey(), ...it })));
  }

  function toggleSession(id: string) {
    setSessionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
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

  /** Checks the document and asks for the last confirmation before issuing. */
  function askIssue() {
    setServerError(null);
    const d = submittable();
    const found = [
      ...documentProblems(d, business.vatLiable),
      // Only the connection can't take it: by hand in morning it's fine
      ...(morningConnected ? morningPaymentProblems(d) : []),
    ];
    setProblems(found);
    if (found.length) {
      setShowPreview(false);
      return;
    }
    if (!morningConnected) {
      // Nothing can be issued from here: the preview offers the way through morning
      openPreview();
      return;
    }
    setConfirmIssue({
      label: info.label,
      code: info.code,
      sender: business.name,
      date: d.date.split("-").reverse().join("/"),
      client: d.clientName,
      amount: money(info.hasItems ? totals.totalAgorot : d.payments.reduce((s, p) => s + p.amountAgorot, 0)),
      emails: d.clientEmails ?? [],
    });
  }

  function openPreview() {
    setServerError(null);
    const found = documentProblems(submittable(), business.vatLiable);
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
      clientEmails: d.clientEmails ?? [],
      date: d.date,
      dueDate: d.dueDate ?? "",
      vatIncluded: d.vatIncluded,
      currency: d.currency,
      lang: d.lang,
      vatType: d.vatType,
      rounding: d.rounding,
      sessionIds: d.sessionIds ?? [],
      draftId: stored?.id ?? "",
      description: d.description ?? "",
      remarks: d.remarks ?? "",
      relatedInvoiceId: related?.id ?? (kind === "CREDIT_NOTE" ? creditOf : ""),
      items: d.items.map((it) => ({
        description: it.description,
        quantity: it.quantity,
        unitPrice: agorotToDecimalString(it.unitPriceAgorot),
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
        details: p.details ?? "",
      })),
    });
  }

  function save(intent: "draft" | "issue") {
    setServerError(null);
    startTransition(async () => {
      try {
        const r = await saveDocumentAction(payloadJson(), intent);
        if (!r.invoiceId) {
          setConfirmIssue(null);
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
        setConfirmIssue(null);
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

  const issueDialog = confirmIssue && (
    <IssueConfirmDialog
      summary={confirmIssue}
      pending={pending}
      onConfirm={() => save("issue")}
      onClose={() => setConfirmIssue(null)}
    />
  );

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

        {issueDialog}
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
                <Button type="button" onClick={askIssue} disabled={pending}>
                  <FileCheck className="w-4 h-4" /> {`הפקת ${info.label} ב-morning`}
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
  const typeChoice = related ? (
    <div className="rounded-2xl border border-cream-300 bg-cream-100 px-4 py-3 text-sm text-ink-soft">
      קבלה על <b>{related.label}</b>. כשהקבלה תופק ב-morning, החשבונית תיסגר שם.
    </div>
  ) : (
    <Card>
      <CardHeader>
        <CardTitle>סוג המסמך</CardTitle>
      </CardHeader>
      <CardContent>
        <DocKindSquares
          vatLiable={business.vatLiable}
          selected={kind}
          onPick={setKind}
        />
        {!business.vatLiable && (
          <p className="text-xs text-ink-muted mt-2">
            בהגדרות העסק מסומן עוסק פטור, ולכן מפיקים קבלות. עוסק מורשה? מסמנים זאת ב״פרטי
            העסק״ ואז מופיעות גם חשבונית מס וחשבונית מס/קבלה.
          </p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        openPreview();
      }}
    >
      {issueDialog}
      {typeChoice}

      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <p className="text-sm text-ink-soft">
              {DOC_CURRENCY_LABELS[currency]} · {DOC_LANG_LABELS[lang]}
              {business.vatLiable ? ` · מע״מ: ${DOC_VAT_TYPE_LABELS[vatType]}` : ""} ·{" "}
              {DOC_ROUNDING_LABELS[rounding ? "on" : "off"]}
            </p>
            <button
              type="button"
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen((o) => !o)}
              className="text-sm text-sage-600 hover:text-sage-700 hover:underline"
            >
              לעריכת ההגדרות
            </button>
          </div>
          {settingsOpen && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs" htmlFor="doc-set-currency">מטבע</Label>
                <Select
                  id="doc-set-currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as DocCurrency)}
                  className="h-10"
                >
                  {DOC_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {DOC_CURRENCY_LABELS[c]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label className="text-xs" htmlFor="doc-set-lang">שפה</Label>
                <Select
                  id="doc-set-lang"
                  value={lang}
                  onChange={(e) => setLang(e.target.value as DocLang)}
                  className="h-10"
                >
                  {DOC_LANGS.map((l) => (
                    <option key={l} value={l}>
                      {DOC_LANG_LABELS[l]}
                    </option>
                  ))}
                </Select>
              </div>
              {business.vatLiable && (
                <div>
                  <Label className="text-xs" htmlFor="doc-set-vat">סוג מע״מ</Label>
                  <Select
                    id="doc-set-vat"
                    value={String(vatType)}
                    onChange={(e) => setVatType(Number(e.target.value) as DocVatType)}
                    className="h-10"
                  >
                    {DOC_VAT_TYPES.map((v) => (
                      <option key={v} value={v}>
                        {DOC_VAT_TYPE_LABELS[v]}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <div>
                <Label className="text-xs" htmlFor="doc-set-rounding">עיגול סכומים</Label>
                <Select
                  id="doc-set-rounding"
                  value={rounding ? "on" : "off"}
                  onChange={(e) => setRounding(e.target.value === "on")}
                  className="h-10"
                >
                  <option value="off">{DOC_ROUNDING_LABELS.off}</option>
                  <option value="on">{DOC_ROUNDING_LABELS.on}</option>
                </Select>
              </div>
            </div>
          )}
          {rounding && <p className="text-xs text-ink-muted">העיגול נעשה ב-morning בהפקה, ולא מוצג כאן בסכומים.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>פרטי המסמך</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {kind === "CREDIT_NOTE" && creditableInvoices.length > 0 && (
            <div>
              <Label htmlFor="doc-credit-of">מסמך מקורי (לא חובה)</Label>
              <Select id="doc-credit-of" value={creditOf} onChange={(e) => pickOriginal(e.target.value)}>
                <option value="">ללא קישור למסמך</option>
                {creditableInvoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-ink-muted mt-1">
                מסמך מקושר מתבטל במלואו, והשורות שלו ממולאות כאן. לזיכוי חלקי משאירים ללא קישור.
              </p>
            </div>
          )}
          <div>
            <Label htmlFor="doc-client">לקוח/ה *</Label>
            <Select
              id="doc-client"
              value={oneOff ? ONE_OFF : clientId}
              disabled={!!related || linked}
              onChange={(e) => pickClient(e.target.value)}
            >
              <option value="">בחירת לקוח/ה מהרשימה (קבוע/מזדמן)</option>
              <option value={ONE_OFF}>לקוח מזדמן (לא ברשימה)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="doc-name">{clientId ? "שם על המסמך *" : "שם הלקוח/ה *"}</Label>
              <Input id="doc-name" value={clientName} onChange={(e) => setClientName(e.target.value)} maxLength={120} />
            </div>
            {info.hasTaxId && (
              <div>
                <Label htmlFor="doc-taxid">ח.פ / ת.ז לקוח</Label>
                <Input
                  id="doc-taxid"
                  value={clientTaxId}
                  onChange={(e) => setClientTaxId(e.target.value)}
                  inputMode="numeric"
                  dir="ltr"
                  className="text-right"
                  maxLength={20}
                  aria-describedby="doc-taxid-hint"
                />
                <p id="doc-taxid-hint" className="text-xs text-ink-muted mt-1">
                  חובה לקבלת מספר הקצאה
                </p>
              </div>
            )}
          </div>
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
        </CardContent>
      </Card>

      {info.hasSessions && clientId && (
        <Card>
          <CardHeader>
            <CardTitle>שיוך לפגישות</CardTitle>
            <p className="text-xs text-ink-muted mt-1">
              פנימי בלבד, לא מופיע במסמך. בהפקה מספר המסמך נרשם בפרטי התשלום של הפגישות שסומנו.
            </p>
          </CardHeader>
          {clientSessions.length > 0 ? (
            <ul className="divide-y divide-cream-200">
              {clientSessions.map((s) => (
                <li key={s.id}>
                  <label className="flex items-center gap-3 px-5 py-2.5 cursor-pointer hover:bg-cream-100/60">
                    <input
                      type="checkbox"
                      checked={sessionIds.includes(s.id)}
                      onChange={() => toggleSession(s.id)}
                      className="w-4 h-4 accent-sage-600"
                    />
                    <span className="flex-1 text-sm text-ink">{s.label}</span>
                    {s.rate && <span className="text-sm text-ink-muted">₪{Number(s.rate)}</span>}
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <CardContent>
              <p className="text-sm text-ink-muted">אין פגישות שעוד לא שויך אליהן תשלום.</p>
            </CardContent>
          )}
        </Card>
      )}

      {info.hasItems && (
        <Card>
          <CardHeader>
            <CardTitle>פירוט הכנסות</CardTitle>
            <p className="text-xs text-ink-muted mt-1">השירות או המוצר שהמסמך עבורם.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.key} className="grid grid-cols-12 gap-2 items-end rounded-xl bg-cream-100 p-2.5">
                  <div className="col-span-12 sm:col-span-5">
                    <Label className="text-xs">פירוט</Label>
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
                  <div className="col-span-4 sm:col-span-2">
                    <Label className="text-xs">מחיר ליחידה</Label>
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
                  <div className="col-span-4 sm:col-span-2">
                    <Label className="text-xs">מטבע</Label>
                    <Select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as DocCurrency)}
                      className="h-10"
                      aria-label="מטבע המסמך"
                    >
                      {DOC_CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {DOC_CURRENCY_LABELS[c]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="col-span-1 flex justify-center pb-2">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setItems((prev) => prev.filter((x) => x.key !== it.key))}
                        className="text-ink-muted hover:text-terracotta-500 p-1"
                        aria-label="הסרת השורה"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {currency !== "ILS" && (
              <p className="text-xs text-ink-muted">
                המטבע משותף לכל שורות המסמך. דוחות ההכנסה בשקלים, ומסמך במטבע אחר לא נספר בהם.
              </p>
            )}
            {/* RTL: the VAT switch first (right), "הוספת שורה" to its left */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
              {business.vatLiable && vatType === 0 && (
                <div className="inline-flex rounded-full border border-cream-300 bg-cream-100 p-1 text-sm">
                  {[
                    { v: true, label: "המחירים כוללים מע״מ", short: "כולל מע״מ" },
                    { v: false, label: "לא כוללים מע״מ", short: "לא כולל מע״מ" },
                  ].map((o) => (
                    <button
                      key={String(o.v)}
                      type="button"
                      onClick={() => setVatIncluded(o.v)}
                      aria-pressed={vatIncluded === o.v}
                      className={cn(
                        "px-2.5 sm:px-3 py-1 rounded-full whitespace-nowrap",
                        vatIncluded === o.v ? "bg-white text-ink shadow-soft" : "text-ink-muted",
                      )}
                    >
                      {/* Short at phone width, so "הוספת שורה" fits on the same row */}
                      <span className="sm:hidden">{o.short}</span>
                      <span className="hidden sm:inline">{o.label}</span>
                    </button>
                  ))}
                </div>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="whitespace-nowrap px-2 sm:px-3"
                onClick={() => setItems((prev) => [...prev, emptyItem(client?.rate)])}
              >
                <Plus className="w-4 h-4" /> הוספת שורה
              </Button>
            </div>
            <div className="ms-auto max-w-xs space-y-1 text-sm">
              {business.vatLiable && vatType === 0 && (
                <>
                  <div className="flex justify-between text-ink-muted">
                    <span>לפני מע״מ</span>
                    <span>{money(totals.netAgorot)}</span>
                  </div>
                  <div className="flex justify-between text-ink-muted">
                    <span>מע״מ {totals.vatPercent}%</span>
                    <span>{money(totals.vatAgorot)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-semibold text-ink border-t border-cream-300 pt-1">
                <span>סה״כ</span>
                <span>{money(totals.totalAgorot)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {info.hasPayments && (
        <Card>
          <CardHeader>
            <CardTitle>פירוט תקבולים</CardTitle>
            <p className="text-xs text-ink-muted mt-1">
              איך שילמו? אפשר כמה תקבולים, למשל חלק ב-Bit וחלק במזומן.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {shownPayments.map((p, idx) => (
              <div key={p.key} className="rounded-xl bg-cream-100 p-3 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end">
                  <div className="col-span-2 sm:col-span-3">
                    <Label className="text-xs">סוג התקבול *</Label>
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
                  <div className="sm:col-span-3">
                    <Label className="text-xs">תאריך *</Label>
                    <Input
                      type="date"
                      value={p.date}
                      onChange={(e) => updatePayment(p.key, { date: e.target.value })}
                      className="h-10"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <Label className="text-xs">סכום *</Label>
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
                  <div className="sm:col-span-2">
                    <Label className="text-xs">מטבע *</Label>
                    <Select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as DocCurrency)}
                      className="h-10"
                      aria-label="מטבע המסמך"
                    >
                      {DOC_CURRENCIES.map((c) => (
                        <option key={c} value={c}>
                          {DOC_CURRENCY_LABELS[c]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="col-span-1 flex justify-center pb-2">
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
                          {paymentDetailLabel(p.method, f)}
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
                            inputMode={f === "bankName" || f === "reference" || f === "details" ? "text" : "numeric"}
                            maxLength={f === "cardLast4" ? 4 : f === "installments" ? 2 : f === "details" ? 100 : 60}
                            dir={f === "bankName" || f === "details" ? undefined : "ltr"}
                            placeholder={f === "details" ? "מה התקבל" : undefined}
                            className="h-10 text-right"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {morningConnected && MANUAL_ONLY_PAYMENT_KINDS.includes(p.method) && (
                  <p className="text-xs text-ink-muted">
                    ל-morning אין סוג תקבול כזה: מסמך עם ״{PAYMENT_KIND_LABELS[p.method]}״ מפיקים ב-morning ידנית.
                  </p>
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
            {info.hasItems && receiptsOff && (
              <p role="status" className="rounded-lg border border-gold-400 bg-gold-200/40 px-3 py-2 text-sm text-ink">
                סכום התקבולים ({money(receivedAgorot)}) שונה מסכום המסמך ({money(totals.totalAgorot)}). הם חייבים להיות שווים כדי להפיק.
              </p>
            )}
            <div className="flex justify-between text-sm max-w-xs ms-auto">
              <span className="text-ink-muted">סה״כ תקבולים</span>
              <span className="font-semibold text-ink">
                {money(receivedAgorot)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

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

      <Card>
        <CardContent className="space-y-2">
          <Label htmlFor="doc-email-0">שליחה במייל</Label>
          <p className="text-xs text-ink-muted">
            {morningConnected
              ? "בהפקה morning שולח את המסמך לכתובות האלה. בלי כתובת המסמך לא נשלח."
              : "הכתובות נשמרות עם המסמך. השליחה נעשית בהפקה דרך morning."}
          </p>
          {emails.map((e, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                id={`doc-email-${i}`}
                type="email"
                dir="ltr"
                className="text-right h-10"
                value={e}
                maxLength={200}
                aria-label={`כתובת מייל ${i + 1}`}
                onChange={(ev) => setEmails((prev) => prev.map((x, j) => (j === i ? ev.target.value : x)))}
              />
              <button
                type="button"
                onClick={() => setEmails((prev) => prev.filter((_, j) => j !== i))}
                className="text-ink-muted hover:text-terracotta-500 p-1"
                aria-label={`הסרת כתובת ${i + 1}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={() => setEmails((prev) => [...prev, ""])}>
            <Plus className="w-4 h-4" /> הוספת כתובת
          </Button>
        </CardContent>
      </Card>

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

      <div className="flex flex-wrap items-center gap-2 justify-end">
        <Link href={stored ? `/invoices/${stored.id}` : "/invoices"}>
          <Button type="button" variant="ghost">
            ביטול
          </Button>
        </Link>
        <Button type="button" variant="secondary" onClick={() => save("draft")} disabled={pending}>
          <Save className="w-4 h-4" /> {pending ? "שומר…" : "שמירה כטיוטה"}
        </Button>
        <Button type="submit" variant="secondary">
          <Eye className="w-4 h-4" /> תצוגה מקדימה
        </Button>
        <Button type="button" onClick={askIssue}>
          <FileCheck className="w-4 h-4" /> הפקת מסמך
        </Button>
      </div>
    </form>
  );
}

/** The receipt lines as shown (a single auto line carries the current total). */
function draftPaymentsFrom(rows: PaymentRow[], draft: DocumentDraft): DocumentDraft["payments"] {
  return rows.map((p, i) => ({ ...draft.payments[i], amountAgorot: parseAgorot(p.amount) ?? 0 }));
}

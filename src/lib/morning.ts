// morning (Green Invoice) API client.
// Official docs (OpenAPI): https://developers.morning.co/api
// Credentials are stored per user (Settings → חיבור ל-morning), the secret
// encrypted at rest (encryptSecret); they never reach the browser.
//
// Documents created here are issued BY morning — registered software under
// the Tax Authority's rules — which is what makes them legal tax documents.
// The app itself never issues one (see src/lib/billing-docs.ts).

import type { MorningCredentials, MorningKeySource } from "@/lib/morning-credentials";
import {
  DOC_KINDS,
  agorotToNumber,
  documentTotals,
  lineAgorot,
  type CardType,
  type DealType,
  type DocKind,
  type DocumentDraft,
  type DraftPayment,
  type PaymentKind,
} from "@/lib/billing-docs";

const PROD_BASE = "https://api.greeninvoice.co.il/api/v1";
const SANDBOX_BASE = "https://sandbox.d.greeninvoice.co.il/api/v1";
// OAuth 2.0 client-credentials token endpoint (a separate host per environment)
const PROD_TOKEN_URL = "https://api.morning.co/idp/v1/oauth/token";
const SANDBOX_TOKEN_URL = "https://api.sandbox.morning.dev/idp/v1/oauth/token";

const REQUEST_TIMEOUT_MS = 20_000;

export function morningBaseUrl(sandbox: boolean): string {
  return sandbox ? SANDBOX_BASE : PROD_BASE;
}

export function morningTokenUrl(sandbox: boolean): string {
  return sandbox ? SANDBOX_TOKEN_URL : PROD_TOKEN_URL;
}

// morning document type codes
export const MORNING_DOC_TYPES = {
  RECEIPT: 400, // קבלה
  TAX_INVOICE: 305, // חשבונית מס
  TAX_INVOICE_RECEIPT: 320, // חשבונית מס-קבלה
  CREDIT_NOTE: 330, // חשבונית זיכוי
} as const;

// payment[].type — 1 cash, 2 cheque, 3 credit card, 4 bank transfer,
// 5 PayPal, 10 payment app (with appType: 1 Bit, 3 PayBox)
const PAYMENT_TYPE: Record<PaymentKind, { type: number; appType?: number }> = {
  CASH: { type: 1 },
  CHECK: { type: 2 },
  CREDIT_CARD: { type: 3 },
  BANK_TRANSFER: { type: 4 },
  PAYPAL: { type: 5 },
  BIT: { type: 10, appType: 1 },
  PAYBOX: { type: 10, appType: 3 },
};

const CARD_TYPE: Record<CardType, number> = {
  ISRACARD: 1,
  VISA: 2,
  MASTERCARD: 3,
  AMEX: 4,
  DINERS: 5,
};

const DEAL_TYPE: Record<DealType, number> = { REGULAR: 1, INSTALLMENTS: 2, CREDIT: 3 };

// income[].vatType — 0 VAT added on top, 1 included in the price
const ITEM_VAT_ADDED = 0;
const ITEM_VAT_INCLUDED = 1;

// Credentials come from one place (manual paste today, morning's partner
// program later) — see morning-credentials.ts. Re-exported for callers.
export type { MorningCredentials, MorningKeySource } from "@/lib/morning-credentials";
export { getMorningCredentials } from "@/lib/morning-credentials";

export type MorningResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      /** no answer came back (timeout / network): the request may still have gone through */
      uncertain?: boolean;
    };

// ── Tokens ──────────────────────────────────────────────────────────────────

// Per-credential token cache; tokens are valid for about an hour.
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

function cacheKeyFor(owner: string, creds: MorningCredentials): string {
  return `${owner}:${creds.sandbox ? "sandbox" : "prod"}:${creds.keyId}`;
}

/** Test hook: forget every cached token. */
export function clearMorningTokenCache(): void {
  tokenCache.clear();
}

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const j = JSON.parse(text) as {
      errorMessage?: string;
      errorCode?: number;
      error_description?: string;
      error?: string;
      message?: string;
    };
    const msg = j.errorMessage ?? j.error_description ?? j.message ?? j.error;
    if (msg) return `${msg}${j.errorCode ? ` (${j.errorCode})` : ""}`;
  } catch {
    // not JSON
  }
  return text.slice(0, 300) || `HTTP ${res.status}`;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
}

/** OAuth 2.0 client credentials (the documented flow). */
async function requestOAuthToken(
  creds: MorningCredentials,
): Promise<MorningResult<{ token: string; expiresAt: number }>> {
  const res = await fetchWithTimeout(morningTokenUrl(creds.sandbox), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: creds.keyId,
      client_secret: creds.secret,
    }),
  });
  if (!res.ok) return { ok: false, error: `(${res.status}) ${await readError(res)}` };
  const json = (await res.json()) as { accessToken?: string; expiresAt?: number };
  if (!json.accessToken) return { ok: false, error: "no accessToken in the response" };
  return {
    ok: true,
    data: {
      token: json.accessToken,
      expiresAt: json.expiresAt ? json.expiresAt * 1000 : Date.now() + 50 * 60_000,
    },
  };
}

/**
 * The older flow (POST {base}/account/token with {id, secret}), which no
 * longer appears in the docs. Kept as a fallback so a connection that works
 * today keeps working; the token came in the body or the
 * X-Authorization-Bearer header.
 */
async function requestLegacyToken(
  creds: MorningCredentials,
): Promise<MorningResult<{ token: string; expiresAt: number }>> {
  const res = await fetchWithTimeout(`${morningBaseUrl(creds.sandbox)}/account/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: creds.keyId, secret: creds.secret }),
  });
  if (!res.ok) return { ok: false, error: `(${res.status}) ${await readError(res)}` };
  const json = (await res.json().catch(() => ({}))) as { token?: string; expires?: number };
  const token = json.token ?? res.headers.get("X-Authorization-Bearer") ?? undefined;
  if (!token) return { ok: false, error: "no token in the response" };
  return {
    ok: true,
    data: { token, expiresAt: json.expires ? json.expires * 1000 : Date.now() + 50 * 60_000 },
  };
}

type TokenResult = MorningResult<{ token: string; expiresAt: number }>;

/**
 * How a token is obtained, per credential source. Adding the partner
 * program means filling in PARTNER here (and a way to receive its keys into
 * morning-credentials.ts); nothing that creates documents changes.
 */
export const TOKEN_STRATEGIES: Record<MorningKeySource, (creds: MorningCredentials) => Promise<TokenResult>> = {
  // Keys pasted in Settings: OAuth client credentials, then the older endpoint
  MANUAL: async (creds) => {
    const oauth = await requestOAuthToken(creds);
    if (oauth.ok) return oauth;
    const legacy = await requestLegacyToken(creds).catch(
      (err): TokenResult => ({ ok: false, error: err instanceof Error ? err.message : String(err) }),
    );
    return legacy.ok ? legacy : oauth;
  },
  // Keys delivered by morning's partner program. Not built: needs the
  // partner authorization code, the partner docs for how a delivered key is
  // exchanged (the public spec says the usual /oauth/token; partner calls
  // themselves use Basic auth with the partner's id:secret), and a callback
  // URL registered with morning to receive {id, email, key{id, secret}}
  // (signed with X-Data-Signature, HMAC-SHA256 of the partner code).
  PARTNER: async () => ({
    ok: false,
    error: "חיבור דרך תוכנית השותפים של morning עדיין לא זמין",
  }),
};

async function getToken(owner: string, creds: MorningCredentials): Promise<MorningResult<string>> {
  const key = cacheKeyFor(owner, creds);
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt > Date.now() + 60_000) return { ok: true, data: cached.token };

  try {
    const result = await TOKEN_STRATEGIES[creds.source ?? "MANUAL"](creds);
    if (!result.ok) return { ok: false, error: `Token request failed ${result.error}` };
    tokenCache.set(key, result.data);
    return { ok: true, data: result.data.token };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function morningRequest<T>(
  creds: MorningCredentials,
  owner: string,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<MorningResult<T>> {
  const token = await getToken(owner, creds);
  if (!token.ok) return token;

  let res: Response;
  try {
    res = await fetchWithTimeout(`${morningBaseUrl(creds.sandbox)}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.data}`,
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch (err) {
    // No answer: for a write, morning may or may not have created it
    return {
      ok: false,
      uncertain: true,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  if (res.status === 401) tokenCache.delete(cacheKeyFor(owner, creds));
  if (!res.ok) return { ok: false, error: `morning ${res.status}: ${await readError(res)}` };
  try {
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, uncertain: true, error: "unreadable response" };
  }
}

export async function testMorningConnection(
  userId: string,
  creds: MorningCredentials,
): Promise<MorningResult<string>> {
  tokenCache.delete(cacheKeyFor(userId, creds));
  return getToken(userId, creds);
}

// ── Document payload (pure — unit tested) ───────────────────────────────────

function nonEmpty(v: string | null | undefined): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

function paymentRow(p: DraftPayment) {
  const code = PAYMENT_TYPE[p.method];
  if (!code) throw new Error(`Unsupported payment method: ${p.method}`);
  const row: Record<string, unknown> = {
    type: code.type,
    date: p.date,
    price: agorotToNumber(p.amountAgorot),
    currency: "ILS",
  };
  if (code.appType) row.appType = code.appType;
  if (p.method === "BANK_TRANSFER" || p.method === "CHECK") {
    row.bankName = nonEmpty(p.bankName);
    row.bankBranch = nonEmpty(p.bankBranch);
    row.bankAccount = nonEmpty(p.bankAccount);
  }
  if (p.method === "CHECK") row.chequeNum = nonEmpty(p.chequeNumber);
  if (p.method === "CREDIT_CARD") {
    if (p.cardType) row.cardType = CARD_TYPE[p.cardType];
    row.cardNum = nonEmpty(p.cardLast4);
    if (p.dealType) row.dealType = DEAL_TYPE[p.dealType];
    if (p.installments) row.numPayments = p.installments;
  }
  if (p.method === "PAYPAL" || p.method === "BIT" || p.method === "PAYBOX") {
    row.transactionId = nonEmpty(p.reference);
  }
  // Drop the details that weren't filled in
  for (const k of Object.keys(row)) if (row[k] === undefined) delete row[k];
  return row;
}

export type MorningPayloadOptions = {
  vatLiable: boolean;
  /** morning ids of the documents this one relates to */
  linkedDocumentIds?: string[];
  /** "link" (a receipt for an invoice) or "cancel" (a credit note) */
  linkType?: "link" | "cancel";
};

/**
 * The POST /documents (and /documents/preview) body for a draft. Prices go
 * as shekels with 2 decimals; the client is printed on the document without
 * being added to her morning client list (add:false); the document's link is
 * emailed only when the draft carries a client email.
 */
export function buildMorningDocumentPayload(draft: DocumentDraft, opts: MorningPayloadOptions) {
  const info = DOC_KINDS[draft.kind];
  const totals = documentTotals(draft, opts.vatLiable);
  const itemVat = !opts.vatLiable || draft.vatIncluded ? ITEM_VAT_INCLUDED : ITEM_VAT_ADDED;

  let income: { description: string; quantity: number; price: number; currency: "ILS"; vatType: number }[];
  if (info.hasItems) {
    income = draft.items.map((it) => ({
      description: it.description.trim(),
      quantity: it.quantity,
      price: agorotToNumber(it.unitPriceAgorot),
      currency: "ILS" as const,
      vatType: itemVat,
    }));
  } else {
    // A receipt shows its receipt lines; morning still takes income rows. The
    // meetings it covers go as rows when they add up to what was received,
    // otherwise one row with the description.
    const linesTotal = draft.items.reduce((s, it) => s + lineAgorot(it), 0);
    income =
      draft.items.length > 0 && linesTotal === totals.paymentsAgorot
        ? draft.items.map((it) => ({
            description: it.description.trim(),
            quantity: it.quantity,
            price: agorotToNumber(it.unitPriceAgorot),
            currency: "ILS" as const,
            vatType: ITEM_VAT_INCLUDED,
          }))
        : [
            {
              description: nonEmpty(draft.description) ?? "תשלום עבור טיפול",
              quantity: 1,
              price: agorotToNumber(totals.paymentsAgorot),
              currency: "ILS" as const,
              vatType: ITEM_VAT_INCLUDED,
            },
          ];
  }

  const payload: Record<string, unknown> = {
    type: info.code,
    date: draft.date,
    lang: "he",
    currency: "ILS",
    vatType: 0, // by business type (עוסק פטור / מורשה)
    description: nonEmpty(draft.description),
    remarks: nonEmpty(draft.remarks),
    client: {
      name: draft.clientName.trim(),
      taxId: nonEmpty(draft.clientTaxId),
      emails: nonEmpty(draft.clientEmail) ? [draft.clientEmail!.trim()] : undefined,
      add: false,
    },
    income,
  };
  if (info.hasDueDate && draft.dueDate) payload.dueDate = draft.dueDate;
  if (info.hasPayments) payload.payment = draft.payments.map(paymentRow);
  if (opts.linkedDocumentIds?.length) {
    payload.linkedDocumentIds = opts.linkedDocumentIds;
    if (opts.linkType) payload.linkType = opts.linkType;
  }
  for (const k of Object.keys(payload)) if (payload[k] === undefined) delete payload[k];
  const client = payload.client as Record<string, unknown>;
  for (const k of Object.keys(client)) if (client[k] === undefined) delete client[k];
  return payload;
}

export type MorningDocumentResponse = {
  id: string;
  number?: string | number;
  url?: { origin?: string; he?: string; en?: string };
};

/** The document's link from a morning response (Hebrew copy first). */
export function morningDocUrl(doc: Pick<MorningDocumentResponse, "url">): string | null {
  return doc.url?.he ?? doc.url?.origin ?? null;
}

export async function createMorningDocument(
  owner: string,
  creds: MorningCredentials,
  payload: Record<string, unknown>,
): Promise<MorningResult<MorningDocumentResponse>> {
  return morningRequest<MorningDocumentResponse>(creds, owner, "/documents", {
    method: "POST",
    body: payload,
  });
}

/** morning's own PDF of the document, before issuing (base64). */
export async function previewMorningDocument(
  owner: string,
  creds: MorningCredentials,
  payload: Record<string, unknown>,
): Promise<MorningResult<string>> {
  const res = await morningRequest<{ file?: string }>(creds, owner, "/documents/preview", {
    method: "POST",
    body: payload,
  });
  if (!res.ok) return res;
  if (!res.data.file) return { ok: false, error: "no file in the preview response" };
  return { ok: true, data: res.data.file };
}

// ── Older app invoices: a receipt for the payments recorded on them ─────────

export type MorningDocumentInput = {
  docType?: number; // 400 (default) or 320
  clientName: string;
  clientEmail?: string | null;
  clientTaxId?: string | null;
  clientAddress?: string | null;
  clientPhone?: string | null;
  description: string;
  items: { description: string; quantity: number; unitPrice: number }[];
  payments: { method: string; amount: number; paidAt: Date }[];
  remarks?: string | null;
};

function isoDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(d);
}

const toAgorot = (n: number) => Math.round(n * 100);

/** A legacy invoice as a draft of the given receipt type. */
export function legacyInvoiceDraft(input: MorningDocumentInput): DocumentDraft {
  const kind: DocKind =
    input.docType === MORNING_DOC_TYPES.TAX_INVOICE_RECEIPT ? "TAX_INVOICE_RECEIPT" : "RECEIPT";
  return {
    kind,
    clientName: input.clientName,
    clientTaxId: input.clientTaxId,
    clientEmail: input.clientEmail,
    // As before: the receipt is dated the day it is issued
    date: isoDate(new Date()),
    vatIncluded: true,
    description: input.description,
    remarks: input.remarks,
    items: input.items.map((it) => ({
      description: it.description,
      quantity: it.quantity,
      unitPriceAgorot: toAgorot(it.unitPrice),
    })),
    payments: input.payments.map((p) => ({
      method: p.method as PaymentKind,
      date: isoDate(p.paidAt),
      amountAgorot: toAgorot(p.amount),
    })),
  };
}

/** Kept for the older invoices' "הפקת קבלה ב-morning" button. */
export function buildMorningReceiptPayload(input: MorningDocumentInput, vatLiable = true) {
  return buildMorningDocumentPayload(legacyInvoiceDraft(input), { vatLiable }) as {
    type: number;
    lang: string;
    currency: string;
    client: { name: string; emails?: string[]; taxId?: string; add: boolean };
    income: { description: string; quantity: number; price: number; vatType: number }[];
    payment: { type: number; appType?: number; price: number; date: string }[];
  };
}

// ── Document search (sync of docs issued directly in morning) ───────────────

export type MorningSearchItem = {
  id: string;
  number?: string | number;
  type?: number;
  documentDate?: string;
  amount?: number;
  description?: string;
  client?: { name?: string };
  url?: { origin?: string; he?: string; en?: string };
};

/** Normalizes a raw search item to the shape stored in MorningDocument. */
export function mapMorningSearchItem(item: MorningSearchItem) {
  return {
    id: item.id,
    number: item.number != null ? String(item.number) : null,
    docType: item.type ?? null,
    docDate: item.documentDate ? new Date(item.documentDate) : null,
    amount: typeof item.amount === "number" ? item.amount : null,
    description: item.description || null,
    morningClientName: item.client?.name || null,
    url: item.url?.he ?? item.url?.origin ?? null,
  };
}

export async function searchMorningDocuments(
  userId: string,
  creds: MorningCredentials,
  params: { fromDate: string; toDate: string },
): Promise<MorningResult<MorningSearchItem[]>> {
  const res = await morningRequest<{ items?: MorningSearchItem[] }>(
    creds,
    userId,
    "/documents/search",
    {
      method: "POST",
      body: {
        page: 1,
        pageSize: 100,
        fromDate: params.fromDate,
        toDate: params.toDate,
        sort: "documentDate",
      },
    },
  );
  if (!res.ok) return res;
  return { ok: true, data: res.data.items ?? [] };
}

// Morning (Green Invoice) API client.
// Docs: https://greeninvoice.docs.apiary.io/ · https://developers.morning.co/
// Credentials are stored per-user (Settings page), secret encrypted at rest.

import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";

const PROD_BASE = "https://api.greeninvoice.co.il/api/v1";
const SANDBOX_BASE = "https://sandbox.d.greeninvoice.co.il/api/v1";

export function morningBaseUrl(sandbox: boolean): string {
  return sandbox ? SANDBOX_BASE : PROD_BASE;
}

// Green Invoice document type codes
export const MORNING_DOC_TYPES = {
  RECEIPT: 400, // קבלה
  TAX_INVOICE: 305, // חשבונית מס
  TAX_INVOICE_RECEIPT: 320, // חשבונית מס-קבלה
} as const;

// Green Invoice payment type codes (verify against docs before changing)
export const MORNING_PAYMENT_TYPES: Record<string, number> = {
  CASH: 1,
  CHECK: 2,
  CREDIT_CARD: 3,
  BANK_TRANSFER: 4,
  PAYPAL: 5,
  BIT: 10, // payment app
  OTHER: 1,
};

export type MorningCredentials = {
  keyId: string;
  secret: string;
  sandbox: boolean;
};

export type MorningResult<T> = { ok: true; data: T } | { ok: false; error: string };

// Per-user token cache; Morning tokens are valid for a limited window.
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getToken(
  cacheKey: string,
  creds: MorningCredentials,
): Promise<MorningResult<string>> {
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return { ok: true, data: cached.token };
  }

  try {
    const res = await fetch(`${morningBaseUrl(creds.sandbox)}/account/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: creds.keyId, secret: creds.secret }),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Token request failed (${res.status}): ${body.slice(0, 200)}` };
    }
    const json = (await res.json()) as { token?: string; expires?: number };
    if (!json.token) return { ok: false, error: "No token in response" };

    // `expires` is a unix timestamp (seconds); fall back to 50 minutes
    const expiresAt = json.expires ? json.expires * 1000 : Date.now() + 50 * 60_000;
    tokenCache.set(cacheKey, { token: json.token, expiresAt });
    return { ok: true, data: json.token };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function morningRequest<T>(
  creds: MorningCredentials,
  cacheKey: string,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<MorningResult<T>> {
  const token = await getToken(cacheKey, creds);
  if (!token.ok) return token;

  try {
    const res = await fetch(`${morningBaseUrl(creds.sandbox)}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.data}`,
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Morning API ${res.status}: ${body.slice(0, 300)}` };
    }
    return { ok: true, data: (await res.json()) as T };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Loads and decrypts the user's Morning credentials; null when not connected. */
export async function getMorningCredentials(
  userId: string,
): Promise<MorningCredentials | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { morningApiKeyId: true, morningApiSecret: true, morningSandbox: true },
  });
  if (!user?.morningApiKeyId || !user.morningApiSecret) return null;
  try {
    return {
      keyId: user.morningApiKeyId,
      secret: decryptSecret(user.morningApiSecret),
      sandbox: user.morningSandbox,
    };
  } catch {
    return null;
  }
}

export async function testMorningConnection(
  userId: string,
  creds: MorningCredentials,
): Promise<MorningResult<string>> {
  tokenCache.delete(userId);
  return getToken(userId, creds);
}

// ── Document payload mapping (pure — unit tested) ──────────────────

export type MorningDocumentInput = {
  docType?: number; // MORNING_DOC_TYPES value; defaults to RECEIPT (400)
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

export function buildMorningReceiptPayload(input: MorningDocumentInput) {
  return {
    type: input.docType ?? MORNING_DOC_TYPES.RECEIPT,
    lang: "he",
    currency: "ILS",
    description: input.description,
    remarks: input.remarks || undefined,
    // add:false — print client details on the document without creating a
    // client record in Morning (avoids duplicates in her Morning client list)
    client: {
      name: input.clientName,
      emails: input.clientEmail ? [input.clientEmail] : undefined,
      taxId: input.clientTaxId || undefined,
      address: input.clientAddress || undefined,
      phone: input.clientPhone || undefined,
      add: false,
    },
    income: input.items.map((it) => ({
      description: it.description,
      quantity: it.quantity,
      price: it.unitPrice,
      currency: "ILS",
      // 1 = price includes VAT (gross). Keeps income total equal to the
      // payments total (Morning error 2422 otherwise); exempt businesses
      // simply show no VAT on receipts.
      vatType: 1,
    })),
    payment: input.payments.map((p) => ({
      type: MORNING_PAYMENT_TYPES[p.method] ?? MORNING_PAYMENT_TYPES.OTHER,
      price: p.amount,
      currency: "ILS",
      date: isoDate(p.paidAt),
    })),
  };
}

export type MorningDocumentResponse = {
  id: string;
  number?: string | number;
  url?: { origin?: string; he?: string; en?: string };
};

export async function createMorningReceipt(
  userId: string,
  creds: MorningCredentials,
  input: MorningDocumentInput,
): Promise<MorningResult<MorningDocumentResponse>> {
  return morningRequest<MorningDocumentResponse>(creds, userId, "/documents", {
    method: "POST",
    body: buildMorningReceiptPayload(input),
  });
}

// ── Document search (sync of docs issued directly in Morning) ──────

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

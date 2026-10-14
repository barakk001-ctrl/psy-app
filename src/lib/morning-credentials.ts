// Where a practice's morning credentials come from — the one seam between
// "how we got the keys" and everything that uses them.
//
// Today: MANUAL — the practitioner creates an API key in morning (personal
// area → developer tools → API keys) and pastes its ID + secret in Settings.
//
// Later: PARTNER — if the operator is approved for morning's partner
// program, the practitioner clicks "connect", approves by email, and morning
// sends the operator a key for her business. That key would be saved here
// with source "PARTNER" (saveMorningCredentials), and morning.ts picks the
// token strategy for that source. The document code (billing-doc-data.ts,
// documents.ts, invoices.ts) only ever calls getMorningCredentials and
// never needs to change. What is still needed from morning to build it is
// listed in morning.ts → PARTNER token strategy.
//
// Secrets are encrypted at rest (encryptSecret) and never leave the server.

import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

export const MORNING_KEY_SOURCES = ["MANUAL", "PARTNER"] as const;
export type MorningKeySource = (typeof MORNING_KEY_SOURCES)[number];

export type MorningCredentials = {
  keyId: string;
  secret: string;
  sandbox: boolean;
  /** how the keys arrived — decides how a token is obtained */
  source: MorningKeySource;
};

type StoredRow = {
  morningApiKeyId: string | null;
  morningApiSecret: string | null;
  morningSandbox: boolean;
  morningKeySource: string | null;
};

/** A stored row → credentials (pure; null when not connected or unreadable). */
export function credentialsFromRow(
  row: StoredRow | null | undefined,
  decrypt: (packed: string) => string = decryptSecret,
): MorningCredentials | null {
  if (!row?.morningApiKeyId || !row.morningApiSecret) return null;
  try {
    return {
      keyId: row.morningApiKeyId,
      secret: decrypt(row.morningApiSecret),
      sandbox: row.morningSandbox,
      source: row.morningKeySource === "PARTNER" ? "PARTNER" : "MANUAL",
    };
  } catch {
    return null;
  }
}

/** The user's morning credentials, decrypted; null when not connected. */
export async function getMorningCredentials(userId: string): Promise<MorningCredentials | null> {
  const row = await db.user.findUnique({
    where: { id: userId },
    select: {
      morningApiKeyId: true,
      morningApiSecret: true,
      morningSandbox: true,
      morningKeySource: true,
    },
  });
  return credentialsFromRow(row);
}

/** Stores (or replaces) the user's keys, encrypting the secret. */
export async function saveMorningCredentials(
  userId: string,
  creds: MorningCredentials,
  extra: { morningDocType?: number } = {},
): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: {
      morningApiKeyId: creds.keyId,
      morningApiSecret: encryptSecret(creds.secret),
      morningSandbox: creds.sandbox,
      morningKeySource: creds.source,
      ...extra,
    },
  });
}

/** Forgets the user's keys ("ניתוק"). */
export async function clearMorningCredentials(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: {
      morningApiKeyId: null,
      morningApiSecret: null,
      morningSandbox: true,
      morningKeySource: "MANUAL",
    },
  });
}

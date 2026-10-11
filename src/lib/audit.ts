import { db } from "@/lib/db";

// Access log for clinical content and sign-ins. Logging must never break the page that
// triggered it — failures are swallowed (the log is best-effort by design).

export type AuditAction =
  | "NOTE_VIEW" // decrypted a single session note for display
  | "RECORD_VIEW" // decrypted a client's clinical record (notes feed)
  | "NOTE_SAVE"
  | "NOTE_DELETE"
  | "NOTE_APPEND"
  | "RECORD_EXPORT" // exported a client's summaries to PDF
  | "SESSIONS_BULK_DELETE" // deleted a client's future meetings (never ones with notes)
  | "PASSWORD_CHANGE" // changed the account password from Settings
  | "CLIENT_TRASH" // moved a client (with their record) to the recycle bin
  | "CLIENT_RESTORE" // restored a client from the recycle bin
  | "CLIENT_PURGE" // deleted a client and their record for good (by hand or after 30 days)
  // Sign-ins (a full session, never a 2FA-pending one), by method:
  | "LOGIN_PASSWORD"
  | "LOGIN_GOOGLE"
  | "LOGIN_EMAIL_CODE" // one-time code by email (src/lib/login-code.ts)
  | "LOGIN_TWO_FACTOR"; // authenticator code entered after Google or a one-time code

export async function logAudit(
  userId: string,
  action: AuditAction,
  ids: { sessionId?: string; clientId?: string } = {},
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId,
        action,
        sessionId: ids.sessionId ?? null,
        clientId: ids.clientId ?? null,
      },
    });
  } catch {
    // best-effort: never let audit failures surface to the user
  }
}

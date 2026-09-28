import { db } from "@/lib/db";

// Access log for clinical content. Logging must never break the page that
// triggered it — failures are swallowed (the log is best-effort by design).

export type AuditAction =
  | "NOTE_VIEW" // decrypted a single session note for display
  | "RECORD_VIEW" // decrypted a client's clinical record (notes feed)
  | "NOTE_SAVE"
  | "NOTE_DELETE"
  | "NOTE_APPEND"
  | "RECORD_EXPORT" // exported a client's summaries to PDF
  | "SESSIONS_BULK_DELETE" // deleted a client's future meetings (never ones with notes)
  | "PASSWORD_CHANGE"; // changed the account password from Settings

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

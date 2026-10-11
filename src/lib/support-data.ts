// Database side of "פנייה לתמיכה": emailing a stored request to support and
// retrying the ones whose email failed. Rules live in support-request.ts.

import { db } from "@/lib/db";
import { decryptBuffer } from "@/lib/crypto";
import { sendEmail, type SendEmailResult } from "@/lib/email";
import { formatDateTime } from "@/lib/format";
import { buildSupportEmail } from "@/lib/support-email";
import {
  EMAIL_RETRY_WINDOW_MS,
  MAX_EMAIL_ATTEMPTS,
  supportRecipient,
} from "@/lib/support-request";

/** Emails one stored request to the support address (with its screenshot). */
export async function emailSupportRequest(id: string): Promise<SendEmailResult> {
  const r = await db.supportRequest.findUnique({
    where: { id },
    include: { user: { select: { email: true } } },
  });
  if (!r) return { ok: false, error: "support request not found" };

  const { subject, html, text } = buildSupportEmail({
    requestId: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    subject: r.subject,
    message: r.message,
    accountEmail: r.user.email,
    pagePath: r.pagePath,
    userAgent: r.userAgent,
    submittedAt: formatDateTime(r.createdAt),
    attachmentName: r.attachmentName,
  });

  const attachments =
    r.attachmentCiphertext && r.attachmentIv && r.attachmentTag && r.attachmentName
      ? [
          {
            filename: r.attachmentName,
            content: decryptBuffer({
              ciphertext: Buffer.from(r.attachmentCiphertext),
              iv: r.attachmentIv,
              tag: r.attachmentTag,
            }),
          },
        ]
      : undefined;

  return sendEmail({
    to: supportRecipient(),
    subject,
    html,
    text,
    replyTo: r.email,
    attachments,
  });
}

/** Writes how the email went onto the request. */
export async function recordSupportEmail(id: string, result: SendEmailResult): Promise<void> {
  await db.supportRequest.update({
    where: { id },
    data: result.ok
      ? { emailStatus: "SENT", emailError: null, emailedAt: new Date(), emailAttempts: { increment: 1 } }
      : {
          emailStatus: "FAILED",
          emailError: result.error.slice(0, 500),
          emailAttempts: { increment: 1 },
        },
  });
  if (!result.ok) console.error(`Support request ${id}: email failed:`, result.error);
}

/**
 * Hourly (src/server/maintenance.ts): requests whose email failed — or that
 * were left PENDING by a crash mid-send — are sent again, a few times, for a
 * few days. Each one is claimed first so two runs never send it twice.
 */
export async function retryFailedSupportEmails(now = new Date()): Promise<number> {
  const since = new Date(now.getTime() - EMAIL_RETRY_WINDOW_MS);
  const stalePending = new Date(now.getTime() - 15 * 60_000);
  const due = await db.supportRequest.findMany({
    where: {
      createdAt: { gte: since },
      emailAttempts: { lt: MAX_EMAIL_ATTEMPTS },
      OR: [
        { emailStatus: "FAILED" },
        { emailStatus: "PENDING", updatedAt: { lt: stalePending } },
      ],
    },
    select: { id: true, emailStatus: true, updatedAt: true },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  let sent = 0;
  for (const r of due) {
    // Claim: only the run that flips it gets to send it
    const claimed = await db.supportRequest.updateMany({
      where: { id: r.id, emailStatus: r.emailStatus, updatedAt: r.updatedAt },
      data: { emailStatus: "PENDING" },
    });
    if (claimed.count !== 1) continue;
    let result: SendEmailResult;
    try {
      result = await emailSupportRequest(r.id);
    } catch (err) {
      result = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    await recordSupportEmail(r.id, result);
    if (result.ok) sent++;
  }
  return sent;
}

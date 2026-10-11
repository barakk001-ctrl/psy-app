import { Resend } from "resend";
import { emailFailureLog } from "@/lib/email-log";

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (resend) return resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  resend = new Resend(key);
  return resend;
}

export type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer }[];
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * Sends an email via Resend. Returns ok:false (instead of throwing) so callers
 * can persist failure state. If Resend is not configured, returns a deterministic
 * error so reminder jobs can still be marked FAILED with a clear reason.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const from = process.env.EMAIL_FROM;
  const fail = (
    reason: string,
    details: { code?: string | null; status?: number | null } = {},
  ): SendEmailResult => {
    // One clear line per failure (provider reason + domains only — no recipient
    // address, subject or body), so the cause is visible in the Railway logs.
    console.error(emailFailureLog({ reason, ...details, from, to: params.to }));
    return { ok: false, error: reason };
  };

  const client = getResend();
  if (!client) return fail("RESEND_API_KEY is not configured");
  if (!from) return fail("EMAIL_FROM is not configured");

  try {
    const { data, error } = await client.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo,
      attachments: params.attachments,
    });
    if (error) {
      const { name, statusCode } = error as { name?: string; statusCode?: number | null };
      return fail(error.message, { code: name, status: statusCode });
    }
    if (!data?.id) return fail("No id returned by Resend");
    return { ok: true, id: data.id };
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
}

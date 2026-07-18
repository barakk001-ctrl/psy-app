import { Resend } from "resend";

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
  const client = getResend();
  if (!client) {
    return { ok: false, error: "RESEND_API_KEY is not configured" };
  }

  const from = process.env.EMAIL_FROM;
  if (!from) {
    return { ok: false, error: "EMAIL_FROM is not configured" };
  }

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
    if (error) return { ok: false, error: error.message };
    if (!data?.id) return { ok: false, error: "No id returned by Resend" };
    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

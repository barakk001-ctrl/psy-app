import { sendEmail } from "@/lib/email";
import { buildLoginCodeEmail, loginCodeSmsText } from "@/lib/login-code-email";

// How a one-time sign-in code reaches the practitioner. Email works today;
// SMS is a slot waiting for a provider:
//
//   1. Write src/lib/sms/<name>.ts exporting a factory `(env) => SmsProvider |
//      null` (null when its keys are missing) and add it to SMS_PROVIDERS.
//   2. Set SMS_PROVIDER=<name> plus that provider's keys (e.g. SMS_API_KEY,
//      SMS_SENDER) on Railway — choose a provider that keeps data in the EU.
//   3. Let the practitioner enter her mobile (User.loginPhone, normalised by
//      normalizeIsraeliMobile) in Settings, and offer "בהודעת SMS" on
//      /login/code when isSmsConfigured().
// Until then everything goes by email, whatever is requested.

export type SendResult = { ok: true } | { ok: false; error: string };

export type LoginCodeRecipient = { email: string; name: string; loginPhone: string | null };

export type ChannelId = "email" | "sms";

export interface SmsProvider {
  /** `to` is E.164 ("+972501234567"). Must not throw: return ok:false. */
  sendSms(to: string, text: string): Promise<SendResult>;
}

type Env = Record<string, string | undefined>;

/** Registered SMS providers by SMS_PROVIDER value. None yet. */
const SMS_PROVIDERS: Record<string, (env: Env) => SmsProvider | null> = {};

export function smsProviderFromEnv(env: Env = process.env): SmsProvider | null {
  const name = env.SMS_PROVIDER?.trim().toLowerCase();
  if (!name) return null;
  const factory = SMS_PROVIDERS[name];
  return factory ? factory(env) : null;
}

export function isSmsConfigured(env: Env = process.env): boolean {
  return smsProviderFromEnv(env) !== null;
}

/** Which channel a code goes out on: SMS only when asked for, set up, and the
 *  account has a mobile number; email otherwise (every account has one). */
export function chooseLoginCodeChannel(
  requested: ChannelId | undefined,
  recipient: Pick<LoginCodeRecipient, "loginPhone">,
  smsConfigured: boolean,
): ChannelId {
  if (requested === "sms" && smsConfigured && normalizeIsraeliMobile(recipient.loginPhone ?? "")) return "sms";
  return "email";
}

/** "050-123 4567" / "+972 50 1234567" / "972501234567" → "+972501234567"; null if not an Israeli mobile. */
export function normalizeIsraeliMobile(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "").replace(/^\+/, "");
  const local = digits.startsWith("972") ? digits.slice(3) : digits.replace(/^0/, "");
  return /^5\d{8}$/.test(local) ? `+972${local}` : null;
}

/** Sends the code on the chosen channel. Never throws. */
export async function sendLoginCode(
  recipient: LoginCodeRecipient,
  code: string,
  requested?: ChannelId,
): Promise<SendResult & { channel: ChannelId }> {
  const sms = smsProviderFromEnv();
  const channel = chooseLoginCodeChannel(requested, recipient, sms !== null);

  if (channel === "sms" && sms) {
    const to = normalizeIsraeliMobile(recipient.loginPhone ?? "")!;
    try {
      return { ...(await sms.sendSms(to, loginCodeSmsText(code))), channel };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "SMS failed", channel };
    }
  }

  const { subject, html, text } = buildLoginCodeEmail({ name: recipient.name, code });
  const result = await sendEmail({ to: recipient.email, subject, html, text });
  return result.ok ? { ok: true, channel } : { ok: false, error: result.error, channel };
}

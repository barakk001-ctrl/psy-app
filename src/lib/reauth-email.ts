import { LOGIN_CODE_TTL_MS } from "@/lib/login-code";

const MINUTES = Math.round(LOGIN_CODE_TTL_MS / 60_000);

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** The email with a code that confirms a sensitive account action (Hebrew, RTL). */
export function buildReauthCodeEmail(params: { name: string; code: string }): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `קוד אימות למרפאה אישית: ${params.code}`;
  const warn =
    "הקוד מאשר הורדה של כל נתוני החשבון או סגירה שלו. אם לא ביקשת — אל תמסרו אותו לאף אחד, ומומלץ לשנות סיסמה.";
  const text = [
    `שלום ${params.name},`,
    "",
    `קוד האימות שלך: ${params.code}`,
    "",
    `הקוד בתוקף ל-${MINUTES} דקות ולשימוש אחד בלבד.`,
    warn,
  ].join("\n");

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<body style="margin:0;padding:0;background:#FAF7F1;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px;" dir="rtl">
    <div style="background:#FDFBF7;border:1px solid #E8E2D5;border-radius:8px;padding:28px;">
      <h1 style="margin:0 0 16px;font-size:20px;color:#1A1714;">קוד אימות</h1>
      <p style="margin:0 0 20px;font-size:15px;color:#3A332C;line-height:1.6;">שלום ${escapeHtml(params.name)},</p>
      <p dir="ltr" style="text-align:center;margin:0 0 20px;font-size:32px;font-weight:bold;letter-spacing:8px;color:#3A4B39;">
        ${params.code}
      </p>
      <p style="margin:0;font-size:13px;color:#6B5F52;line-height:1.6;">
        הקוד בתוקף ל-${MINUTES} דקות ולשימוש אחד בלבד. ${warn}
      </p>
    </div>
  </div>
</body>
</html>`;
  return { subject, html, text };
}

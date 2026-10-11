// The email support receives for each "פנייה לתמיכה". Only what the user typed
// plus technical context (page type, browser) — never anything from the
// practice's records.

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type SupportEmailInput = {
  requestId: string;
  name: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  accountEmail?: string | null;
  pagePath?: string | null;
  userAgent?: string | null;
  submittedAt: string; // already formatted in clinic time
  attachmentName?: string | null;
};

export function buildSupportEmail(p: SupportEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `פנייה לתמיכה: ${p.subject.replace(/[\r\n]+/g, " ").slice(0, 120)}`;

  const rows: [string, string][] = [
    ["שם", p.name],
    ["אימייל", p.email],
    ...(p.phone ? ([["טלפון", p.phone]] as [string, string][]) : []),
    ...(p.accountEmail && p.accountEmail.toLowerCase() !== p.email.toLowerCase()
      ? ([["אימייל החשבון", p.accountEmail]] as [string, string][])
      : []),
    ["נשלח", p.submittedAt],
    ...(p.pagePath ? ([["עמוד", p.pagePath]] as [string, string][]) : []),
    ...(p.attachmentName ? ([["צורף קובץ", p.attachmentName]] as [string, string][]) : []),
    ["מזהה פנייה", p.requestId],
  ];

  const text = [
    `פנייה חדשה לתמיכה — ${p.subject}`,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    "תיאור:",
    p.message,
    ...(p.userAgent ? ["", `דפדפן: ${p.userAgent}`] : []),
  ].join("\n");

  const rowHtml = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 0 4px 12px;color:#6B5F52;white-space:nowrap;vertical-align:top;">${escapeHtml(k)}</td><td style="padding:4px 0;color:#1A1714;">${escapeHtml(v)}</td></tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<body style="margin:0;padding:0;background:#FAF7F1;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:28px 18px;" dir="rtl">
    <div style="background:#FDFBF7;border:1px solid #E8E2D5;border-radius:8px;padding:24px;">
      <p style="margin:0 0 6px;font-size:12px;color:#5C7559;font-weight:bold;">פנייה לתמיכה — מרפאה אישית</p>
      <h1 style="margin:0 0 16px;font-size:19px;color:#1A1714;">${escapeHtml(p.subject)}</h1>
      <table style="border-collapse:collapse;font-size:14px;margin:0 0 18px;" dir="rtl">${rowHtml}</table>
      <div style="font-size:15px;color:#3A332C;line-height:1.7;white-space:pre-wrap;background:#fff;border:1px solid #F2EDE2;border-radius:6px;padding:14px;">${escapeHtml(p.message)}</div>
      ${
        p.userAgent
          ? `<p style="margin:16px 0 0;font-size:11px;color:#9A8E80;" dir="ltr">${escapeHtml(p.userAgent)}</p>`
          : ""
      }
    </div>
    <p style="margin:12px 0 0;font-size:12px;color:#9A8E80;">אפשר להשיב למייל הזה — התשובה תגיע ישירות לפונה.</p>
  </div>
</body>
</html>`;

  return { subject, html, text };
}

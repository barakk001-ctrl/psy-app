// The emails of the sign-up flow. Neither carries the name typed at sign-up:
// anyone can type any address on the form, so nothing they typed may reach
// that mailbox from our domain.

const APP_NAME = "מרפאה אישית";

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<body style="margin:0;padding:0;background:#FAF7F1;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px;" dir="rtl">
    <div style="background:#FDFBF7;border:1px solid #E8E2D5;border-radius:8px;padding:28px;">
      <h1 style="margin:0 0 16px;font-size:20px;color:#1A1714;">${title}</h1>
      ${body}
    </div>
  </div>
</body>
</html>`;
}

const P = "margin:0 0 16px;font-size:15px;color:#3A332C;line-height:1.6;";
const SMALL = "margin:0;font-size:13px;color:#6B5F52;line-height:1.6;";
const BUTTON =
  "display:inline-block;background:#5C7559;color:#FDFBF7;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:bold;";

export function buildVerifyEmail(params: { verifyUrl: string }): { subject: string; html: string; text: string } {
  const subject = `אישור כתובת האימייל — ${APP_NAME}`;
  const text = [
    "שלום,",
    "",
    `כדי לסיים את פתיחת החשבון ב${APP_NAME}, יש לאשר את כתובת האימייל:`,
    params.verifyUrl,
    "",
    "הקישור בתוקף ל-24 שעות. אם לא נפתח כאן חשבון על ידך, אפשר להתעלם מההודעה.",
  ].join("\n");
  const html = layout(
    "אישור כתובת האימייל",
    `<p style="${P}">כדי לסיים את פתיחת החשבון ב${APP_NAME}, יש לאשר את כתובת האימייל:</p>
      <p style="text-align:center;margin:0 0 20px;">
        <a href="${params.verifyUrl}" style="${BUTTON}">אישור הכתובת</a>
      </p>
      <p style="${SMALL}">הקישור בתוקף ל-24 שעות. אם לא נפתח כאן חשבון על ידך, אפשר להתעלם מההודעה.</p>`,
  );
  return { subject, html, text };
}

/** Sent instead of a link when someone signs up with an address that already has an account. */
export function buildExistingAccountEmail(params: {
  loginUrl: string;
  resetUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `ניסיון הרשמה עם הכתובת שלך — ${APP_NAME}`;
  const text = [
    "שלום,",
    "",
    `התקבל ניסיון לפתוח חשבון ב${APP_NAME} עם הכתובת הזו, וכבר יש לה חשבון. החשבון לא השתנה.`,
    `להתחברות: ${params.loginUrl}`,
    `לקביעת סיסמה חדשה: ${params.resetUrl}`,
    "",
    "אם הניסיון לא היה שלך, אפשר להתעלם מההודעה.",
  ].join("\n");
  const html = layout(
    "כבר יש לך חשבון",
    `<p style="${P}">התקבל ניסיון לפתוח חשבון ב${APP_NAME} עם הכתובת הזו, וכבר יש לה חשבון. החשבון לא השתנה.</p>
      <p style="${P}">
        <a href="${params.loginUrl}" style="color:#4A6147;font-weight:bold;">להתחברות</a>
        &nbsp;·&nbsp;
        <a href="${params.resetUrl}" style="color:#4A6147;">קביעת סיסמה חדשה</a>
      </p>
      <p style="${SMALL}">אם הניסיון לא היה שלך, אפשר להתעלם מההודעה.</p>`,
  );
  return { subject, html, text };
}

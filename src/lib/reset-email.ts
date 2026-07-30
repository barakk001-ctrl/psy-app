export function buildResetEmail(params: {
  name: string;
  resetUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = "איפוס סיסמה — מרפאה";

  const text = [
    `שלום ${params.name},`,
    "",
    "התקבלה בקשה לאיפוס הסיסמה לחשבון שלך. לקביעת סיסמה חדשה:",
    params.resetUrl,
    "",
    "הקישור בתוקף לשעה אחת. אם לא ביקשת איפוס — אפשר להתעלם מההודעה, הסיסמה לא שונתה.",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<body style="margin:0;padding:0;background:#FAF7F1;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px;" dir="rtl">
    <div style="background:#FDFBF7;border:1px solid #E8E2D5;border-radius:8px;padding:28px;">
      <h1 style="margin:0 0 16px;font-size:20px;color:#1A1714;">איפוס סיסמה</h1>
      <p style="margin:0 0 12px;font-size:15px;color:#3A332C;line-height:1.6;">
        שלום ${params.name},
      </p>
      <p style="margin:0 0 20px;font-size:15px;color:#3A332C;line-height:1.6;">
        התקבלה בקשה לאיפוס הסיסמה לחשבון שלך במרפאה. לחצו על הכפתור לקביעת סיסמה חדשה:
      </p>
      <p style="text-align:center;margin:0 0 20px;">
        <a href="${params.resetUrl}"
           style="display:inline-block;background:#5C7559;color:#FDFBF7;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:bold;">
          קביעת סיסמה חדשה
        </a>
      </p>
      <p style="margin:0;font-size:13px;color:#6B5F52;line-height:1.6;">
        הקישור בתוקף לשעה אחת. אם לא ביקשת איפוס — אפשר להתעלם מההודעה, הסיסמה לא שונתה.
      </p>
    </div>
  </div>
</body>
</html>`;

  return { subject, html, text };
}

type ReminderInput = {
  clientFirstName: string;
  practitionerName: string;
  practitionerPhone: string | null;
  sessionStartsAt: Date;
  location: "OFFICE" | "ONLINE" | "HOME_VISIT" | "OTHER";
  meetingUrl: string | null;
  hoursBefore: number;
};

const LOCATION_LABELS = {
  OFFICE: "בקליניקה",
  ONLINE: "מקוון",
  HOME_VISIT: "ביקור בית",
  OTHER: "אחר",
} as const;

function formatHebrewDate(d: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Jerusalem",
  }).format(d);
}

function formatHebrewTime(d: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  }).format(d);
}

function timingPhrase(hoursBefore: number, sessionStartsAt: Date): string {
  if (hoursBefore <= 2) {
    return `בעוד כשעה (בשעה ${formatHebrewTime(sessionStartsAt)})`;
  }
  if (hoursBefore <= 26) {
    return `מחר (${formatHebrewDate(sessionStartsAt)} בשעה ${formatHebrewTime(sessionStartsAt)})`;
  }
  return `${formatHebrewDate(sessionStartsAt)} בשעה ${formatHebrewTime(sessionStartsAt)}`;
}

export function buildReminderEmail(input: ReminderInput) {
  const subject = `תזכורת לפגישה — ${formatHebrewDate(input.sessionStartsAt)}`;

  const timing = timingPhrase(input.hoursBefore, input.sessionStartsAt);
  const locationLine = input.location === "ONLINE" && input.meetingUrl
    ? `מקוון (קישור: ${input.meetingUrl})`
    : LOCATION_LABELS[input.location];

  const text = [
    `שלום ${input.clientFirstName},`,
    "",
    `זוהי תזכורת לפגישה שלך ${timing}.`,
    "",
    `תאריך: ${formatHebrewDate(input.sessionStartsAt)}`,
    `שעה: ${formatHebrewTime(input.sessionStartsAt)}`,
    `מיקום: ${locationLine}`,
    "",
    "אם יש צורך לשנות או לבטל את הפגישה, נא ליצור קשר.",
    "",
    `תודה,`,
    input.practitionerName,
    input.practitionerPhone ? `טל׳: ${input.practitionerPhone}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#FAF7F1;font-family:'Helvetica Neue',Arial,sans-serif;color:#1A1714;">
  <div dir="rtl" style="max-width:520px;margin:0 auto;padding:32px 24px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#FFFFFF;border:1px solid #E8E2D5;border-radius:8px;">
      <tr><td style="padding:32px;">
        <p style="margin:0 0 16px 0;font-size:18px;font-weight:500;">שלום ${input.clientFirstName},</p>
        <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#3A332C;">
          זוהי תזכורת לפגישה שלך ${timing}.
        </p>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#FAF7F1;border-radius:6px;margin:16px 0;">
          <tr><td style="padding:16px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="padding:4px 0;color:#6B5F52;font-size:13px;width:80px;">תאריך</td>
                <td style="padding:4px 0;color:#1A1714;font-size:14px;font-weight:500;">${formatHebrewDate(input.sessionStartsAt)}</td>
              </tr>
              <tr>
                <td style="padding:4px 0;color:#6B5F52;font-size:13px;">שעה</td>
                <td style="padding:4px 0;color:#1A1714;font-size:14px;font-weight:500;">${formatHebrewTime(input.sessionStartsAt)}</td>
              </tr>
              <tr>
                <td style="padding:4px 0;color:#6B5F52;font-size:13px;">מיקום</td>
                <td style="padding:4px 0;color:#1A1714;font-size:14px;font-weight:500;">${LOCATION_LABELS[input.location]}</td>
              </tr>
            </table>
            ${input.location === "ONLINE" && input.meetingUrl
              ? `<div style="margin-top:12px;"><a href="${input.meetingUrl}" style="display:inline-block;background-color:#5C7559;color:#FDFBF7;padding:10px 20px;border-radius:4px;text-decoration:none;font-size:14px;font-weight:500;">פתיחת קישור הפגישה</a></div>`
              : ""}
          </td></tr>
        </table>

        <p style="margin:24px 0 0 0;font-size:13px;color:#6B5F52;line-height:1.6;">
          אם משהו השתנה ויש צורך לעדכן או לבטל את הפגישה, נא ליצור קשר.
        </p>

        <p style="margin:24px 0 0 0;font-size:14px;color:#1A1714;">
          תודה,<br/>
          <strong>${input.practitionerName}</strong>
          ${input.practitionerPhone ? `<br/><span style="color:#6B5F52;">טל׳: <span dir="ltr">${input.practitionerPhone}</span></span>` : ""}
        </p>
      </td></tr>
    </table>
    <p style="margin:16px 0;font-size:11px;color:#9A8E80;text-align:center;">
      תזכורת אוטומטית — אין צורך להשיב להודעה זו.
    </p>
  </div>
</body>
</html>`;

  return { subject, html, text };
}

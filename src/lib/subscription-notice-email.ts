// The trial / subscription emails. Transactional: they are about the reader's
// own account, so the footer names the operator and there is no unsubscribe.
// Public text rules apply: the business name only, nothing about VAT.

import { formatDate } from "@/lib/format";
import { OPERATOR_EMAIL, OPERATOR_FOOTER } from "@/lib/operator";
import { trialDaysLeftText } from "@/lib/plans";
import { escapeHtml } from "@/lib/support-email";
import type { DueNotice } from "@/lib/subscription-notices";

const BRAND = "מרפאה אישית";
const PAGE = "״מנוי ומסלולים״";
const READ_ONLY = "המערכת עוברת למצב קריאה בלבד, וכל המידע נשאר זמין לצפייה ולייצוא.";

function wording(notice: DueNotice): { title: string; lines: string[] } {
  const date = formatDate(notice.periodEnd);
  const trial = notice.kind === "TRIAL";
  const thing = trial ? "תקופת הניסיון" : "המנוי";
  const yours = `${thing} שלך ב${BRAND}`;

  if (notice.stage === "ENDED") {
    return {
      title: trial ? "תקופת הניסיון הסתיימה" : "המנוי הסתיים",
      lines: [
        `${yours} ${trial ? "הסתיימה" : "הסתיים"} ב-${date}, והמערכת עברה למצב קריאה בלבד.`,
        `כל המידע שמור וזמין לצפייה ולייצוא. כדי לחזור לעבוד, ${
          trial ? "בוחרים מנוי" : "מחדשים את המנוי"
        } בעמוד ${PAGE}.`,
      ],
    };
  }

  const left = trialDaysLeftText(notice.daysLeft);
  return {
    title: trial ? `${left} בתקופת הניסיון` : `${left} למנוי`,
    lines: [
      `${yours} ${trial ? "מסתיימת" : "מסתיים"} ב-${date}.`,
      `כדי להמשיך לעבוד כרגיל, ${
        trial ? "בוחרים מנוי" : "מחדשים את המנוי"
      } בעמוד ${PAGE}.`,
      `${trial ? "אין חיוב אוטומטי." : "המנוי לא מתחדש אוטומטית."} ${
        trial ? "בלי מנוי" : "בלי חידוש"
      } ${READ_ONLY}`,
    ],
  };
}

export function buildSubscriptionNoticeEmail(params: {
  name: string;
  notice: DueNotice;
  subscriptionUrl: string;
}): { subject: string; html: string; text: string; replyTo: string } {
  const { title, lines } = wording(params.notice);
  const subject = `${title} — ${BRAND}`;
  const footer = `הודעת שירות על החשבון שלך ב${BRAND}.`;

  const text = [
    `שלום ${params.name},`,
    "",
    ...lines,
    "",
    `מנוי ומסלולים: ${params.subscriptionUrl}`,
    "",
    footer,
    OPERATOR_FOOTER,
    `לשאלות: ${OPERATOR_EMAIL}`,
  ].join("\n");

  const paragraphs = lines
    .map(
      (l) =>
        `<p style="margin:0 0 12px;font-size:15px;color:#3A332C;line-height:1.6;">${escapeHtml(l)}</p>`,
    )
    .join("\n      ");

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<body style="margin:0;padding:0;background:#FAF7F1;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px;" dir="rtl">
    <div style="background:#FDFBF7;border:1px solid #E8E2D5;border-radius:8px;padding:28px;">
      <h1 style="margin:0 0 16px;font-size:20px;color:#1A1714;">${escapeHtml(title)}</h1>
      <p style="margin:0 0 12px;font-size:15px;color:#3A332C;line-height:1.6;">שלום ${escapeHtml(params.name)},</p>
      ${paragraphs}
      <p style="text-align:center;margin:20px 0 4px;">
        <a href="${escapeHtml(params.subscriptionUrl)}" style="display:inline-block;background-color:#4A6048;color:#FDFBF7;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:500;">מנוי ומסלולים</a>
      </p>
    </div>
    <p style="margin:16px 4px 0;font-size:12px;color:#6B5F52;text-align:center;line-height:1.6;">
      ${escapeHtml(footer)}<br/>
      ${escapeHtml(OPERATOR_FOOTER)}<br/>
      לשאלות: <a href="mailto:${OPERATOR_EMAIL}" style="color:#6B5F52;" dir="ltr">${OPERATOR_EMAIL}</a>
    </p>
  </div>
</body>
</html>`;

  return { subject, html, text, replyTo: OPERATOR_EMAIL };
}

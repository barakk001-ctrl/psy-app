import { CLOSURE_GRACE_DAYS } from "@/lib/account-closure";

// The emails around closing an account (Hebrew, RTL). Sent to the account's own
// address, so a closure nobody meant is noticed while it can still be undone.

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function wrap(title: string, paragraphs: string[]): string {
  const body = paragraphs
    .map((p) => `<p style="margin:0 0 12px;font-size:15px;color:#3A332C;line-height:1.6;">${escapeHtml(p)}</p>`)
    .join("\n      ");
  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<body style="margin:0;padding:0;background:#FAF7F1;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px;" dir="rtl">
    <div style="background:#FDFBF7;border:1px solid #E8E2D5;border-radius:8px;padding:28px;">
      <h1 style="margin:0 0 16px;font-size:20px;color:#1A1714;">${escapeHtml(title)}</h1>
      ${body}
    </div>
  </div>
</body>
</html>`;
}

function email(subject: string, title: string, paragraphs: string[]) {
  return { subject, html: wrap(title, paragraphs), text: paragraphs.join("\n\n") };
}

const dayText = (d: Date) =>
  new Intl.DateTimeFormat("he-IL", { dateStyle: "long", timeZone: "Asia/Jerusalem" }).format(d);

export function buildAccountClosedEmail(p: { name: string; purgeAfter: Date; origin: string }) {
  return email("החשבון שלך במרפאה אישית נסגר", "החשבון נסגר", [
    `שלום ${p.name},`,
    `החשבון נסגר לפי בקשה מתוך ההגדרות. עד ${dayText(p.purgeAfter)} אפשר להיכנס, לשחזר אותו כפי שהיה ולהוריד את כל הנתונים: ${p.origin}/login`,
    `אחרי ${CLOSURE_GRACE_DAYS} הימים האלה כל המידע נמחק לצמיתות ולא ניתן לשחזור.`,
    "חובות שמירת הרשומות הטיפוליות ומסמכי המס נשארות באחריותך גם אחרי הסגירה.",
    "לא ביקשת לסגור את החשבון? היכנסו ושחזרו אותו, החליפו סיסמה וכתבו לתמיכה.",
  ]);
}

export function buildAccountRestoredEmail(p: { name: string }) {
  return email("החשבון שלך במרפאה אישית שוחזר", "החשבון שוחזר", [
    `שלום ${p.name},`,
    "החשבון שוחזר, וכל המידע בו נשאר כפי שהיה. סנכרון היומן והטופס לבקשת פגישה פועלים שוב.",
    "לא ביקשת את זה? החליפו סיסמה וכתבו לתמיכה.",
  ]);
}

export function buildAccountPurgedEmail(p: { name: string }) {
  return email("החשבון שלך במרפאה אישית נמחק", "החשבון נמחק", [
    `שלום ${p.name},`,
    "תקופת השחזור הסתיימה, וכל המידע בחשבון נמחק לצמיתות מהמערכת. מהגיבויים הוא יימחק בתוך 30 יום נוספים.",
  ]);
}

/** To the operator: a live practice closing is worth a human look. */
export function buildClosureNoticeEmail(p: {
  email: string;
  exempt: boolean;
  purgeAfter: Date;
}) {
  return email("חשבון נסגר", "חשבון נסגר", [
    `החשבון ${p.email} נסגר על ידי בעליו${p.exempt ? " (חשבון פטור ממנוי)" : ""}.`,
    `המידע יימחק לצמיתות ב-${dayText(p.purgeAfter)}, אלא אם החשבון ישוחזר. הפירוט בהגדרות, ב״סגירות חשבון ממתינות״.`,
  ]);
}

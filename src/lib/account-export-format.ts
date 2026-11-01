// How the full account export is written: pure, tested. The DB side and the
// ZIP stream are in account-export.ts.

/** Excel reads a UTF-8 CSV as Hebrew only with this mark. */
export const CSV_BOM = "﻿";

/**
 * One CSV cell. A value that starts like a spreadsheet formula gets a leading
 * apostrophe: much of this text was typed by clients (messages, requests), and
 * opening the export must not run it. Plain numbers and phone numbers stay as
 * they are.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s: string;
  if (value instanceof Date) s = value.toISOString();
  else if (typeof value === "object") s = String(value); // Prisma Decimal
  else s = String(value);
  if (/^[=+\-@\t\r]/.test(s) && !/^[+-]?[\d\s().,-]+$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvLine(cells: unknown[]): string {
  return `${cells.map(csvCell).join(",")}\r\n`;
}

/** A file or folder name that is safe on Windows, Mac and in a ZIP. */
export function safeFileName(name: string, fallback = "קובץ"): string {
  const clean = name
    .replace(/[\p{Cc}\\/:*?"<>|]/gu, " ")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 120)
    .trim();
  return clean || fallback;
}

/** A client's folder: readable, and two people with one name never merge. */
export function clientFolder(c: { id: string; firstName: string; lastName: string }): string {
  return safeFileName(`${c.firstName} ${c.lastName} (${c.id.slice(-6)})`, c.id);
}

/** Hands out paths, numbering repeats: "מכתב.pdf", "מכתב (2).pdf". */
export function pathAllocator(): (path: string) => string {
  const taken = new Set<string>();
  return (path) => {
    if (!taken.has(path)) {
      taken.add(path);
      return path;
    }
    const dot = path.lastIndexOf(".");
    const slash = path.lastIndexOf("/");
    const hasExt = dot > slash + 1;
    const stem = hasExt ? path.slice(0, dot) : path;
    const ext = hasExt ? path.slice(dot) : "";
    for (let n = 2; ; n++) {
      const next = `${stem} (${n})${ext}`;
      if (!taken.has(next)) {
        taken.add(next);
        return next;
      }
    }
  };
}

export const SESSION_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "מתוכננת",
  COMPLETED: "התקיימה",
  CANCELLED: "בוטלה",
  NO_SHOW: "לא התקיימה",
};

export const SESSION_PAYMENT_LABELS: Record<string, string> = {
  PAID: "שולם",
  UNPAID: "טרם שולם",
  EXEMPT: "ללא תשלום",
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "טיוטה",
  SENT: "נשלח",
  PARTIALLY_PAID: "שולם חלקית",
  PAID: "שולם",
  CANCELLED: "בוטל",
};

export const README_TEXT = [
  "הורדה מלאה של החשבון במרפאה אישית",
  "",
  "הקובץ הזה מכיל את כל המידע שבחשבון, בטקסט גלוי ולא מוצפן. יש בו רשומות טיפוליות,",
  "ולכן כדאי לשמור אותו במקום מאובטח ולמחוק עותקים שלא צריך.",
  "",
  "מה יש כאן:",
  "- חשבון.json: פרטי החשבון והעסק",
  "- לקוחות.csv, פגישות.csv, סיכומים.csv: הטבלאות, לפתיחה ב-Excel או בכל גיליון אחר",
  "- תשלומים.csv, חשבוניות ומסמכים.csv, שורות חשבונית.csv, מסמכי morning.csv: כספים ומסמכים",
  "- רשימת המתנה.csv, משימות.csv, סוגי מפגשים.csv, הודעות נכנסות.csv, פניות תמיכה.csv",
  "- יומן גישה.csv, תשלומי מנוי.csv",
  "- סיכומים/: קובץ טקסט לכל לקוח/ה, עם הסיכומים לפי סדר הפגישות",
  "- מסמכים/: המסמכים שהועלו לתיקים, בתיקייה לכל לקוח/ה",
  "- קבצי פגישות/: הקבצים שצורפו לפגישות",
  "- פניות תמיכה/: צילומי מסך שצורפו לפניות",
  "- סיכום הייצוא.txt: כמה נכתב מכל סוג, ואם משהו לא הצליח להיקרא",
  "",
  "לקוחות שנמצאים בסל המחזור כלולים, ומסומנים בעמודה ״נמחק/ה בתאריך״.",
  "תאריכים ושעות הם לפי שעון ישראל.",
  "",
  "מה לא כלול, כי אלה פרטי אבטחה ולא מידע של הקליניקה: סיסמה, קודי אימות,",
  "מפתחות החיבור ל-morning וקישורים פרטיים.",
  "",
].join("\r\n");

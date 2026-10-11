import "./zod-hebrew";
import { z } from "zod";

const trimmed = (max: number) => z.string().trim().max(max, `עד ${max} תווים`);

/** "פנייה לתמיכה" — the help widget's contact form. */
export const supportRequestSchema = z.object({
  name: trimmed(80).min(2, "נא למלא שם"),
  email: z.string().trim().email("כתובת אימייל לא תקינה").max(120),
  phone: trimmed(30)
    .refine((v) => v === "" || /^[0-9+\-\s()]{7,30}$/.test(v), "מספר טלפון לא תקין")
    .optional()
    .default(""),
  subject: trimmed(120).min(2, "נא לכתוב נושא קצר"),
  message: trimmed(5000).min(10, "נא לתאר את הבקשה (לפחות 10 תווים)"),
  pagePath: z.string().max(500).optional().default(""),
});

export type SupportRequestInput = z.infer<typeof supportRequestSchema>;

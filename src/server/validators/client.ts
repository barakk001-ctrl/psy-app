import "./zod-hebrew";
import { z } from "zod";

export const clientSchema = z.object({
  firstName: z.string().min(1, "נדרש שם פרטי").max(80),
  lastName: z.string().min(1, "נדרש שם משפחה").max(80),
  idNumber: z
    .string()
    .trim()
    .max(20)
    .optional()
    .or(z.literal("")),
  email: z.string().email("כתובת אימייל לא תקינה").optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  defaultRate: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === "" || v === null) return undefined;
      const n = typeof v === "number" ? v : parseFloat(v);
      return Number.isNaN(n) ? undefined : n;
    }),
  generalNotes: z.string().max(2000).optional().or(z.literal("")),
});

export type ClientInput = z.infer<typeof clientSchema>;

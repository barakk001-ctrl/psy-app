import "./zod-hebrew";
import { z } from "zod";

export const personalDetailsSchema = z.object({
  name: z.string().min(2, "נדרש שם").max(80),
  email: z.string().email("כתובת אימייל לא תקינה").max(120),
  phone: z.string().max(30).optional().or(z.literal("")),
});

export type PersonalDetailsInput = z.infer<typeof personalDetailsSchema>;

export const businessInfoSchema = z.object({
  businessName: z.string().max(120).optional().or(z.literal("")),
  businessId: z.string().max(20).optional().or(z.literal("")),
  vatLiable: z.preprocess((v) => v === "true" || v === true, z.boolean()),
  address: z.string().max(200).optional().or(z.literal("")),
  defaultRate: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === "" || v === null) return undefined;
      const n = typeof v === "number" ? v : parseFloat(v);
      return Number.isNaN(n) ? undefined : n;
    }),
});

export type BusinessInfoInput = z.infer<typeof businessInfoSchema>;

import "./zod-hebrew";
import { z } from "zod";
import { isValidLogoDataUrl } from "@/lib/branding";

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

/** How long a meeting runs by default. Bounded rather than free: a stray digit
 *  in a settings box would otherwise quietly schedule 500-minute sessions and
 *  overlap-checking would start rejecting everything. */
export const sessionDefaultsSchema = z.object({
  defaultSessionMinutes: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === "number" ? v : parseInt(v, 10)))
    .refine((n) => Number.isFinite(n), "משך לא תקין")
    .refine((n) => n >= 5 && n <= 480, "המשך חייב להיות בין 5 ל-480 דקות"),
});

export type SessionDefaultsInput = z.infer<typeof sessionDefaultsSchema>;

/** The practice's own name and logo in the app header. `logo` is a data: URL
 *  from the browser, "" to leave the current one, or "REMOVE" to clear it. */
export const brandingSchema = z.object({
  brandName: z.string().trim().max(60, "עד 60 תווים").optional().or(z.literal("")),
  logo: z
    .string()
    .refine((v) => v === "" || v === "REMOVE" || isValidLogoDataUrl(v), "קובץ התמונה לא תקין או גדול מדי"),
});

export type BrandingInput = z.infer<typeof brandingSchema>;

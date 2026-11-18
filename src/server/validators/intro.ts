import { z } from "zod";
import { CLINIC_TYPE_MAX, workingHoursError } from "@/lib/intro";
import { sessionDefaultsSchema } from "@/server/validators/settings";

/** Decimal(10,2) holds up to 99,999,999.99; a session price is far below it. */
const RATE_MAX = 100_000;

/**
 * The שאלון היכרות's answers (rules in src/lib/intro.ts). Every key is
 * optional: a key that is absent is left as it is, so one question can be
 * saved at a time. An empty value clears that answer.
 */
export const introAnswersSchema = z
  .object({
    clinicType: z.string().trim().max(CLINIC_TYPE_MAX, `עד ${CLINIC_TYPE_MAX} תווים`),
    clientGroups: z.array(z.string().max(20)).max(10),
    workingHours: z.unknown().superRefine((v, ctx) => {
      const error = workingHoursError(v);
      if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error });
    }),
    // "" = no preference
    dashboardFocus: z.string().max(20),
    // a set's id from src/lib/color-themes.ts; anything else = the default set
    colorTheme: z.string().max(20),
    // a word's id from src/lib/client-word.ts; anything else = "לקוחות"
    clientWord: z.string().max(20),
    defaultSessionMinutes: sessionDefaultsSchema.shape.defaultSessionMinutes,
    // "" = no usual price
    defaultRate: z
      .union([z.string(), z.number()])
      .transform((v) => (typeof v === "number" ? v : v.trim() === "" ? null : Number(v)))
      .refine((n) => n === null || (Number.isFinite(n) && n >= 0 && n <= RATE_MAX), "מחיר לא תקין"),
  })
  .partial()
  .strict();

export type IntroAnswersInput = z.infer<typeof introAnswersSchema>;

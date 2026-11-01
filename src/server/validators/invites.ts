import "./zod-hebrew";
import { z } from "zod";
import { INVITE_MAX_USES } from "@/lib/invite-codes";

export const inviteCodeSchema = z.object({
  note: z.string().trim().max(100, "ההערה ארוכה מדי"),
  maxUses: z.coerce
    .number()
    .int("מספר השימושים חייב להיות מספר שלם")
    .min(1, "לפחות שימוש אחד")
    .max(INVITE_MAX_USES, `עד ${INVITE_MAX_USES} שימושים`),
  expiresInDays: z.coerce.number().int().min(0).max(365),
});

import "./zod-hebrew";
import { z } from "zod";
import { WAITLIST_NAME_MAX, WAITLIST_NOTES_MAX, WAITLIST_PHONE_MAX } from "@/lib/waitlist";

export const waitlistEntrySchema = z.object({
  fullName: z.string().trim().min(1, "נדרש שם מלא").max(WAITLIST_NAME_MAX),
  phone: z.string().trim().max(WAITLIST_PHONE_MAX).optional().or(z.literal("")),
  notes: z.string().trim().max(WAITLIST_NOTES_MAX).optional().or(z.literal("")),
});

export type WaitlistEntryInput = z.infer<typeof waitlistEntrySchema>;

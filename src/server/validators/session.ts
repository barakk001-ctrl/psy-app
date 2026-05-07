import { z } from "zod";

export const sessionLocations = ["OFFICE", "ONLINE", "HOME_VISIT", "OTHER"] as const;
export const sessionStatuses = ["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;

const datetimeLocal = z
  .string()
  .min(1, "נדרש תאריך ושעה")
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "תאריך לא תקין");

export const createSessionSchema = z
  .object({
    clientId: z.string().min(1, "נדרש לקוח"),
    startsAt: datetimeLocal,
    durationMinutes: z
      .union([z.string(), z.number()])
      .transform((v) => (typeof v === "number" ? v : parseInt(v, 10)))
      .pipe(z.number().int().min(15).max(240)),
    location: z.enum(sessionLocations).default("OFFICE"),
    meetingUrl: z.string().url("קישור לא תקין").optional().or(z.literal("")),
    rate: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => {
        if (v === undefined || v === "" || v === null) return undefined;
        const n = typeof v === "number" ? v : parseFloat(v);
        return Number.isNaN(n) ? undefined : n;
      }),
  })
  .refine(
    (d) => d.location !== "ONLINE" || (d.meetingUrl && d.meetingUrl.length > 0),
    {
      message: "פגישה מקוונת דורשת קישור",
      path: ["meetingUrl"],
    },
  );

export const updateSessionSchema = createSessionSchema.partial().extend({
  id: z.string(),
});

export const sessionStatusSchema = z.object({
  id: z.string(),
  status: z.enum(sessionStatuses),
});

export const noteSchema = z.object({
  sessionId: z.string(),
  content: z.string().max(20000),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type NoteInput = z.infer<typeof noteSchema>;

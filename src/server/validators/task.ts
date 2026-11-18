import "./zod-hebrew";
import { z } from "zod";
import { TASK_NOTE_MAX, TASK_TITLE_MAX, isDay } from "@/lib/tasks";

export const taskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "נדרש שם למשימה")
    .max(TASK_TITLE_MAX, `עד ${TASK_TITLE_MAX} תווים`),
  note: z.string().trim().max(TASK_NOTE_MAX, `עד ${TASK_NOTE_MAX} תווים`).optional().or(z.literal("")),
  dueDay: z
    .string()
    .trim()
    .refine((v) => v === "" || isDay(v), "תאריך לא תקין")
    .optional(),
  clientId: z.string().trim().max(64).optional(),
});

export type TaskInput = z.infer<typeof taskSchema>;

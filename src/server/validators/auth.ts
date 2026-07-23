import "./zod-hebrew";
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("כתובת אימייל לא תקינה"),
  password: z.string().min(1, "נדרשת סיסמה"),
  totp: z.string().optional().or(z.literal("")),
});

export const registerSchema = z.object({
  name: z.string().min(2, "השם חייב להכיל לפחות 2 תווים"),
  email: z.string().email("כתובת אימייל לא תקינה"),
  password: z
    .string()
    .min(8, "הסיסמה חייבת להיות באורך 8 תווים לפחות")
    .regex(/[A-Za-z]/, "הסיסמה חייבת לכלול לפחות אות אחת")
    .regex(/[0-9]/, "הסיסמה חייבת לכלול לפחות ספרה אחת"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

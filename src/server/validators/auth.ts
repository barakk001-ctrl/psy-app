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

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z
      .string()
      .min(8, "הסיסמה חייבת להיות באורך 8 תווים לפחות")
      .regex(/[A-Za-z]/, "הסיסמה חייבת לכלול לפחות אות אחת")
      .regex(/[0-9]/, "הסיסמה חייבת לכלול לפחות ספרה אחת"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "הסיסמאות אינן תואמות",
    path: ["confirm"],
  });

/** Settings → שינוי סיסמה: the current password, then the new one twice (same rules as registration). */
export const changePasswordSchema = z
  .object({
    current: z.string().min(1, "נדרשת הסיסמה הנוכחית"),
    password: z
      .string()
      .min(8, "הסיסמה חייבת להיות באורך 8 תווים לפחות")
      .regex(/[A-Za-z]/, "הסיסמה חייבת לכלול לפחות אות אחת")
      .regex(/[0-9]/, "הסיסמה חייבת לכלול לפחות ספרה אחת"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "הסיסמאות אינן תואמות",
    path: ["confirm"],
  })
  .refine((d) => d.password !== d.current, {
    message: "הסיסמה החדשה זהה לנוכחית",
    path: ["password"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

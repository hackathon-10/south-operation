import { z } from 'zod';

// NoCyberHere: INPUT_VALIDATION
// Threat: ניסיונות Credential Stuffing ושליחת קלט חריג למסלול ההתחברות
// Reason: תיחום קשיח של שדות ההתחברות לפני בדיקת הסיסמה

export const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email({ message: 'כתובת האימייל אינה תקינה' })
      .max(120),
    password: z.string().min(8, 'הסיסמה חייבת להכיל לפחות 8 תווים').max(200),
  })
  .strict();
export type LoginInput = z.infer<typeof loginSchema>;

/** Refresh Token מגיע מ-cookie מסוג HttpOnly; הגוף נשאר ריק בכוונה. */
export const refreshSchema = z.object({}).strict();

export const demoLoginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(120),
  })
  .strict();

import { z } from 'zod';

// NoCyberHere: SECRET_MANAGEMENT
// Threat: הרצת השרת עם סודות חלשים, חסרים או ערכי ברירת מחדל מהקוד
// Reason: אימות משתני הסביבה בעת העלייה. שרת עם קונפיגורציה לא בטוחה פשוט לא יעלה.

const secretSchema = z
  .string()
  .min(32, 'סוד JWT חייב להכיל לפחות 32 תווים')
  .refine((value) => !/^(change-me|secret|password|test)$/i.test(value.trim()), {
    message: 'סוד JWT אינו יכול להיות ערך ברירת מחדל',
  });

const booleanFromEnv = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),

    DATABASE_URL: z.string().min(1, 'DATABASE_URL חסר'),
    DIRECT_URL: z.string().optional(),

    JWT_ACCESS_SECRET: secretSchema,
    JWT_REFRESH_SECRET: secretSchema,
    JWT_ACCESS_TTL: z.string().default('15m'),
    JWT_REFRESH_TTL: z.string().default('7d'),

    /** רשימת Origins מורשים ל-CORS, מופרדים בפסיק. */
    CORS_ORIGINS: z.string().default('http://localhost:5173'),
    PUBLIC_WEB_URL: z.string().url().default('http://localhost:5173'),

    /** מסך בחירת משתמשי דמו. לפיתוח והדגמה בלבד. */
    ENABLE_DEMO_LOGIN: booleanFromEnv,
    /**
     * סיסמת משתמשי הדמו, משמשת גם את ה-seed וגם את מסך הדמו.
     * מחרוזת ריקה (כמו ב-.env.example) נחשבת "לא הוגדר", בדיוק כמו שלא היה מוגדר
     * בכלל - אחרת כל מי שמעתיק את .env.example כלשונו נתקל בכשל אימות בעלייה.
     */
    SEED_DEMO_PASSWORD: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.string().min(8).optional(),
    ),

    /** נשמר בצד השרת בלבד ולעולם לא נחשף ל-Frontend. */
    SUPABASE_URL: z.string().url().optional().or(z.literal('')),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional().or(z.literal('')),

    SWAGGER_ENABLED: z.enum(['true', 'false']).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message: 'בפרודקשן נדרשים סודות שונים ל-Access ול-Refresh',
      });
    }
    if (env.NODE_ENV === 'production' && env.CORS_ORIGINS.includes('*')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGINS'],
        message: 'אסור להגדיר CORS פתוח בפרודקשן',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export interface AppConfig extends Omit<Env, 'CORS_ORIGINS'> {
  corsOrigins: string[];
  swaggerEnabled: boolean;
  isProduction: boolean;
  isTest: boolean;
}

/**
 * מאמת את משתני הסביבה ומחזיר אובייקט קונפיגורציה מוקשח.
 * נכשל במהירות (fail fast) אם משהו חסר או חלש.
 */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    // לא מדפיסים את הערכים עצמם, רק את שמות המשתנים שנכשלו.
    throw new Error(`תצורת הסביבה אינה תקינה:\n${details}`);
  }

  const env = parsed.data;
  const corsOrigins = env.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    ...env,
    corsOrigins,
    swaggerEnabled: env.SWAGGER_ENABLED ? env.SWAGGER_ENABLED === 'true' : true,
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
  };
}

export const APP_CONFIG = 'APP_CONFIG';

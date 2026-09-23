import { INestApplication, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * שירות Prisma יחיד לכל האפליקציה.
 *
 * NoCyberHere: PARAMETERIZED_DATABASE_ACCESS
 * Threat: SQL Injection
 * Reason: כל הגישה למסד עוברת דרך Prisma. אין שרשור מחרוזות לתוך SQL.
 *
 * בסביבת Serverless (Vercel) מופע הלקוח נשמר על globalThis כדי שלא ייפתחו
 * חיבורים חדשים בכל בקשה. החיבור עצמו עובר דרך ה-Connection Pooler של Supabase.
 */

const globalForPrisma = globalThis as unknown as { prismaClient?: PrismaClient };

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
      errorFormat: 'minimal',
    });

    if (!globalForPrisma.prismaClient) {
      globalForPrisma.prismaClient = this;
    }
  }

  async onModuleInit(): Promise<void> {
    this.warnIfPoolingMisconfigured();

    // חיבור יזום נכשל => app.init() נכשל => הפונקציה כולה קורסת ב-Vercel עם
    // FUNCTION_INVOCATION_FAILED אטום, וכל בקשה אחריה נכשלת באותו אופן.
    // Prisma מתחבר ממילא בעצלתיים בשאילתה הראשונה, ולכן עדיף להמשיך לעלות:
    // כך /health מדווח "database: down" ושאר הבקשות מחזירות שגיאה מסודרת
    // בעברית במקום קריסה שאי אפשר לאבחן.
    try {
      await this.$connect();
      this.logger.log('החיבור למסד הנתונים נוצר בהצלחה');
    } catch {
      this.logger.error(
        'החיבור הראשוני למסד הנתונים נכשל. השרת ממשיך לעלות וינסה להתחבר בשאילתה הבאה.',
      );
    }
  }

  /**
   * ב-Serverless כל מופע פונקציה פותח Pool משלו. מול Session Pooler (פורט 5432)
   * כל חיבור תופס חיבור Postgres ייעודי, והמכסה נגמרת:
   * FATAL: (EMAXCONNSESSION) max clients reached in session mode.
   * האזהרה הזו מצביעה על הסיבה במקום להשאיר שגיאת חיבור גנרית.
   */
  private warnIfPoolingMisconfigured(): void {
    if (!process.env.VERCEL) return;
    const url = process.env.DATABASE_URL ?? '';
    if (url.includes('pgbouncer=true')) return;

    this.logger.warn(
      'DATABASE_URL אינו מוגדר ל-Transaction Pooler (pgbouncer=true&connection_limit=1). ' +
        'ב-Serverless זה גורם לניצול כל חיבורי ה-Session Pooler ולכשל EMAXCONNSESSION.',
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** בדיקת חיות אמיתית למסד, לשימוש ב-Health endpoint. */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      // לא מדליפים את פרטי החיבור או את הודעת המסד ללוג התפעולי.
      this.logger.error('בדיקת החיבור למסד הנתונים נכשלה');
      return false;
    }
  }

  enableShutdownHooks(app: INestApplication): void {
    process.on('beforeExit', () => {
      void app.close();
    });
  }
}

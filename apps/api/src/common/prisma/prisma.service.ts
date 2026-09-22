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
    await this.$connect();
    this.logger.log('החיבור למסד הנתונים נוצר בהצלחה');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** בדיקת חיות אמיתית למסד, לשימוש ב-Health endpoint. */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
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

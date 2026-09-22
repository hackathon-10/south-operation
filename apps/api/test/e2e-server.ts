/**
 * שרת API לבדיקות דפדפן (Playwright).
 *
 * מריץ את אותה אפליקציית NestJS, אך מול מסד PostgreSQL שרץ בתוך התהליך (PGlite)
 * ועם ה-Seed המלא. כך אפשר להריץ את תרחיש הדפדפן בלי Docker ובלי Supabase.
 *
 * זהו קוד בדיקות בלבד. סביבת הפרודקשן משתמשת ב-src/main.ts ובחיבור אמיתי ל-Supabase.
 */
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { API_PREFIX } from '../src/bootstrap';
import { AllExceptionsFilter } from '../src/common/errors/all-exceptions.filter';
import { TraceIdMiddleware } from '../src/common/http/trace-id.middleware';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { runSeed } from '../prisma/seed';
import { createTestDatabase } from './test-database';

const PORT = Number(process.env.E2E_API_PORT ?? 3001);

async function bootstrap(): Promise<void> {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://e2e:e2e@localhost:5432/e2e';
  process.env.JWT_ACCESS_SECRET = 'e2e-access-secret-that-is-long-enough-32-chars';
  process.env.JWT_REFRESH_SECRET = 'e2e-refresh-secret-that-is-long-enough-32-chars';
  process.env.CORS_ORIGINS = process.env.CORS_ORIGINS ?? 'http://localhost:5173';
  process.env.PUBLIC_WEB_URL = process.env.PUBLIC_WEB_URL ?? 'http://localhost:5173';
  process.env.ENABLE_DEMO_LOGIN = 'true';
  process.env.SEED_DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'Demo!2345';
  process.env.SWAGGER_ENABLED = 'false';

  const database = await createTestDatabase();
  await runSeed(database.prisma);

  const prismaStub = Object.assign(database.prisma, {
    isHealthy: async () => true,
    enableShutdownHooks: () => undefined,
    onModuleInit: async () => undefined,
    onModuleDestroy: async () => undefined,
  });

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue(prismaStub)
    .compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix(API_PREFIX);
  app.use(new TraceIdMiddleware().use.bind(new TraceIdMiddleware()));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors({
    origin: process.env.CORS_ORIGINS!.split(','),
    credentials: true,
  });

  await app.listen(PORT, '127.0.0.1');
  console.log(`[e2e] API לבדיקות עלה על פורט ${PORT}`);
}

void bootstrap();

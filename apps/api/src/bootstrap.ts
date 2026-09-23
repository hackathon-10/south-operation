import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { APP_CONFIG, AppConfig } from './common/config/env.config';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';
import { TraceIdMiddleware } from './common/http/trace-id.middleware';

export const API_PREFIX = 'api/v1';

/**
 * מגדיר על אפליקציית Nest קיימת (מ-NestFactory.create או מ-Test.createTestingModule)
 * את כל שכבות האבטחה והתשתית המשותפות.
 *
 * חובה לקרוא לפונקציה הזו מכל נקודת כניסה שמריצה את ה-API (הרצה מקומית, Vercel,
 * ושרת ההדגמה/Playwright ב-test/e2e-server.ts) - אחרת סביבות שונות מקבלות הגדרות
 * אבטחה שונות בלי ששמים לב (למשל: בלי cookie-parser, ה-Refresh Token לעולם לא
 * ייקרא מה-Cookie וכל רענון סשן ייכשל בשקט).
 */
export function configureApp(app: INestApplication): AppConfig {
  const config = app.get<AppConfig>(APP_CONFIG);

  app.setGlobalPrefix(API_PREFIX);

  // NoCyberHere: HTTP_SECURITY_HEADERS
  // Threat: התקפות מבוססות דפדפן (Clickjacking, MIME sniffing, דליפת Referrer)
  // Reason: Helmet מגדיר כותרות אבטחה. CSP מוגדר במפורש, בלי להסתמך על ברירת המחדל.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  app.use(cookieParser());
  app.use(new TraceIdMiddleware().use.bind(new TraceIdMiddleware()));

  // NoCyberHere: CORS
  // Threat: גישה חוצת-מקור לא מורשית ל-API מאומת
  // Reason: רשימת Origins מפורשת מהסביבה, עם credentials. אין כאן '*'.
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-trace-id'],
    exposedHeaders: ['x-trace-id'],
    maxAge: 600,
  });

  // NoCyberHere: INPUT_VALIDATION
  // Threat: Mass assignment ושדות לא מוכרים בגוף הבקשה
  // Reason: אימות ראשי מתבצע בסכמות Zod (strict); ValidationPipe מוסיף שכבת הגנה
  //         לכל DTO מבוסס Class ומבטיח whitelist מלא.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validateCustomDecorators: false,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  if (config.swaggerEnabled) {
    const documentConfig = new DocumentBuilder()
      .setTitle('דרומה - API')
      .setDescription(
        'API לניהול אריזה, שינוע, קליטה ופיזור של ציוד בין בסיסים לקריית התקשוב. ' +
          'כל הנתונים במערכת הם נתוני דמה סינתטיים.',
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Access Token' },
        'bearer',
      )
      .addTag('Auth', 'התחברות, רענון והתנתקות')
      .addTag('Reference Data', 'בסיסים, יחידות, צוותים, חדרים ומפות')
      .addTag('Catalog', 'קטלוג מוצרים ומחשבים/מסכים')
      .addTag('Packing Tasks', 'משימות אריזה')
      .addTag('Packages', 'אריזות, תכולה, QR וסריקה')
      .addTag('Transport Missions', 'שליחויות, מסלול וביצוע')
      .addTag('Mission Join Requests', 'בקשות הצטרפות לשליחות')
      .addTag('Dashboard', 'תמונת מצב לפי תפקיד')
      .addTag('Audit', 'יומן פעולות')
      .addTag('Health', 'בדיקת חיות')
      .build();

    const document = SwaggerModule.createDocument(app, documentConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
      customSiteTitle: 'דרומה - API',
    });
  }

  if (config.ENABLE_DEMO_LOGIN && config.isProduction) {
    new Logger('Bootstrap').warn(
      'ENABLE_DEMO_LOGIN פעיל בסביבת פרודקשן. מסך בחירת משתמשי הדמו יהיה זמין.',
    );
  }

  return config;
}

/**
 * בניית האפליקציה להרצה מקומית (`main.ts`) ול-Serverless ב-Vercel (`api/index.ts`).
 * שרת ההדגמה/Playwright (`test/e2e-server.ts`) בונה את ה-App דרך
 * `Test.createTestingModule` (כדי להחליף את `PrismaService`) וקורא ל-`configureApp`
 * ישירות במקום לפונקציה הזו.
 */
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  configureApp(app);

  return app;
}

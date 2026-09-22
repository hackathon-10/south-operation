import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import { ApiErrorBody, ERROR_CATALOG } from '@south/shared';
import type { Request, Response } from 'express';
import { AppException } from './app.exception';

/**
 * מסנן שגיאות גלובלי - נקודת היציאה היחידה של שגיאות ללקוח.
 *
 * NoCyberHere: ERROR_INFORMATION_DISCLOSURE
 * Threat: חשיפת stack trace, שמות טבלאות או פרטי חיבור ללקוח
 * Reason: כל שגיאה מתורגמת לפורמט אחיד עם קוד והודעה בעברית. הפרטים נשארים בלוג השרת.
 *
 * NoCyberHere: SECURITY_LOGGING
 * Threat: חוסר ראות על כשלי הרשאה ואימות
 * Reason: שגיאות 401/403/429 נרשמות עם traceId, בלי סיסמאות או Tokens.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { traceId?: string }>();
    const traceId = request.traceId ?? 'unknown';

    const body = this.toErrorBody(exception, traceId);

    if (body.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${body.statusCode} [${body.code}] trace=${traceId}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else if ([401, 403, 429].includes(body.statusCode)) {
      this.logger.warn(
        `${request.method} ${request.url} -> ${body.statusCode} [${body.code}] trace=${traceId}`,
      );
    } else {
      this.logger.debug(
        `${request.method} ${request.url} -> ${body.statusCode} [${body.code}] trace=${traceId}`,
      );
    }

    response.status(body.statusCode).json(body);
  }

  private toErrorBody(exception: unknown, traceId: string): ApiErrorBody {
    if (exception instanceof AppException) {
      const payload = exception.getResponse() as ApiErrorBody;
      return { ...payload, traceId };
    }

    if (exception instanceof ThrottlerException) {
      return {
        statusCode: ERROR_CATALOG.RATE_LIMITED.status,
        code: 'RATE_LIMITED',
        message: ERROR_CATALOG.RATE_LIMITED.message,
        details: null,
        traceId,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const code = this.mapStatusToCode(status);
      const details =
        typeof raw === 'object' && raw !== null && 'details' in raw
          ? (raw as { details: unknown }).details
          : null;
      return {
        statusCode: status,
        code,
        message: ERROR_CATALOG[code].message,
        details,
        traceId,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.mapPrismaError(exception, traceId);
    }

    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return {
        statusCode: ERROR_CATALOG.DATABASE_UNAVAILABLE.status,
        code: 'DATABASE_UNAVAILABLE',
        message: ERROR_CATALOG.DATABASE_UNAVAILABLE.message,
        details: null,
        traceId,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: ERROR_CATALOG.INTERNAL_ERROR.message,
      details: null,
      traceId,
    };
  }

  private mapPrismaError(
    error: Prisma.PrismaClientKnownRequestError,
    traceId: string,
  ): ApiErrorBody {
    // P2002 = הפרת ייחודיות, P2003 = הפרת מפתח זר, P2025 = רשומה לא נמצאה,
    // P0001/23514 = הפרת Check Constraint.
    switch (error.code) {
      case 'P2002':
        return {
          statusCode: ERROR_CATALOG.DUPLICATE_BUSINESS_KEY.status,
          code: 'DUPLICATE_BUSINESS_KEY',
          message: ERROR_CATALOG.DUPLICATE_BUSINESS_KEY.message,
          details: null,
          traceId,
        };
      case 'P2025':
        return {
          statusCode: 404,
          code: 'RESOURCE_NOT_FOUND',
          message: ERROR_CATALOG.RESOURCE_NOT_FOUND.message,
          details: null,
          traceId,
        };
      default:
        return {
          statusCode: 409,
          code: 'DUPLICATE_BUSINESS_KEY',
          message: 'הפעולה סותרת נתון קיים במערכת',
          details: null,
          traceId,
        };
    }
  }

  private mapStatusToCode(status: number): keyof typeof ERROR_CATALOG {
    switch (status) {
      case 400:
        return 'VALIDATION_FAILED';
      case 401:
        return 'NOT_AUTHENTICATED';
      case 403:
        return 'FORBIDDEN_ROLE';
      case 404:
        return 'RESOURCE_NOT_FOUND';
      case 422:
        return 'VALIDATION_FAILED';
      case 429:
        return 'RATE_LIMITED';
      default:
        return 'INTERNAL_ERROR';
    }
  }
}

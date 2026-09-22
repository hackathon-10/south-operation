import { HttpException } from '@nestjs/common';
import { AppErrorCode, ERROR_CATALOG } from '@south/shared';

/**
 * שגיאה עסקית עם קוד מקטלוג השגיאות המשותף.
 *
 * NoCyberHere: ERROR_INFORMATION_DISCLOSURE
 * Threat: דליפת פרטי מימוש (stack traces, שגיאות מסד, נתיבים) ללקוח
 * Reason: הלקוח מקבל קוד שגיאה והודעה אנושית בעברית בלבד. הפרטים הטכניים נשארים בלוג.
 */
export class AppException extends HttpException {
  readonly code: AppErrorCode;
  readonly details?: unknown;

  constructor(code: AppErrorCode, details?: unknown) {
    const definition = ERROR_CATALOG[code];
    super(
      {
        statusCode: definition.status,
        code,
        message: definition.message,
        details: details ?? null,
      },
      definition.status,
    );
    this.code = code;
    this.details = details;
  }

  static notFound(code: AppErrorCode): AppException {
    return new AppException(code);
  }
}

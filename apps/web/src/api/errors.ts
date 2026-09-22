import { AxiosError } from 'axios';
import { ApiErrorBody, AppErrorCode, ErrorDefinition, humanizeApiError } from '@south/shared';

/**
 * תרגום שגיאת רשת להודעה אנושית בעברית.
 *
 * המשתמש לעולם אינו רואה "403" או "404" - רק משפט ברור ופעולה אפשרית (§5.4, §11).
 */
export function toUserError(
  error: unknown,
  fallback: AppErrorCode = 'INTERNAL_ERROR',
): ErrorDefinition & { traceId?: string; code?: string } {
  if (error instanceof AxiosError) {
    if (!error.response) {
      return {
        status: 0,
        message: 'אין חיבור לשרת כרגע',
        hint: 'בדקו את החיבור לרשת ונסו שוב',
      };
    }
    const body = error.response.data as ApiErrorBody | undefined;
    return { ...humanizeApiError(body, fallback), traceId: body?.traceId, code: body?.code };
  }

  return humanizeApiError(null, fallback);
}

export function errorFieldMessages(error: unknown): Record<string, string> {
  if (!(error instanceof AxiosError)) return {};
  const details = (error.response?.data as ApiErrorBody | undefined)?.details;
  if (!Array.isArray(details)) return {};

  const messages: Record<string, string> = {};
  for (const detail of details as Array<{ field?: string; message?: string }>) {
    if (detail.field && detail.message) messages[detail.field] = detail.message;
  }
  return messages;
}

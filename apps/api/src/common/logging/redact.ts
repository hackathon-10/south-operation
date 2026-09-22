/**
 * NoCyberHere: SECURITY_LOGGING
 * Threat: כתיבת סיסמאות, Tokens או פרטים אישיים מלאים ללוגים
 * Reason: כל אובייקט שנכתב ללוג או ל-Audit עובר כאן, והשדות הרגישים מוחלפים ב-[redacted].
 */

const SENSITIVE_KEYS = [
  'password',
  'passwordhash',
  'newpassword',
  'currentpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'publictoken',
  'authorization',
  'cookie',
  'secret',
  'apikey',
  'servicerolekey',
];

/** מספר אישי מוצג ממוסך: 3 ספרות אחרונות בלבד. */
export function maskIdentityNumber(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length <= 3) return '***';
  return `***${trimmed.slice(-3)}`;
}

export function redact<T>(value: T, depth = 0): T {
  if (depth > 6 || value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1)) as unknown as T;
  }

  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(source)) {
      const normalized = key.toLowerCase();
      if (SENSITIVE_KEYS.includes(normalized)) {
        result[key] = '[redacted]';
      } else if (normalized.includes('identitynumber')) {
        result[key] = maskIdentityNumber(typeof item === 'string' ? item : null);
      } else {
        result[key] = redact(item, depth + 1);
      }
    }
    return result as unknown as T;
  }

  return value;
}

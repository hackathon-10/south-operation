/**
 * הגדרת סביבת הבדיקות.
 * הסודות כאן הם ערכי בדיקה בלבד ואינם משמשים בשום סביבה אמיתית.
 */
module.exports = async (): Promise<void> => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/test';
  process.env.JWT_ACCESS_SECRET =
    'test-access-secret-that-is-long-enough-32-chars';
  process.env.JWT_REFRESH_SECRET =
    'test-refresh-secret-that-is-long-enough-32-chars';
  process.env.JWT_ACCESS_TTL = '15m';
  process.env.JWT_REFRESH_TTL = '7d';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.PUBLIC_WEB_URL = 'http://localhost:5173';
  process.env.ENABLE_DEMO_LOGIN = 'false';
  process.env.SWAGGER_ENABLED = 'false';
};

import { defineConfig, devices } from '@playwright/test';

const API_PORT = 3001;
const WEB_PORT = 5174;

/**
 * תרחיש הדפדפן המרכזי (§14).
 *
 * שני השרתים עולים אוטומטית:
 * - API לבדיקות עם מסד PostgreSQL בתוך התהליך ו-Seed מלא (בלי Docker ובלי Supabase).
 * - אפליקציית ה-Web שמכוונת ל-API הזה.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    locale: 'he-IL',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    {
      command: 'npm run e2e:server -w @south/api',
      url: `http://127.0.0.1:${API_PORT}/api/v1/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        E2E_API_PORT: String(API_PORT),
        CORS_ORIGINS: `http://127.0.0.1:${WEB_PORT},http://localhost:${WEB_PORT}`,
        PUBLIC_WEB_URL: `http://127.0.0.1:${WEB_PORT}`,
        SEED_DEMO_PASSWORD: 'Demo!2345',
      },
    },
    {
      command: `npm run dev -w @south/web -- --port ${WEB_PORT} --host 127.0.0.1 --strictPort`,
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        VITE_API_BASE_URL: `http://127.0.0.1:${API_PORT}/api/v1`,
      },
    },
  ],
});

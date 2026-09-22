import 'reflect-metadata';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../src/bootstrap';

/**
 * נקודת הכניסה ל-Vercel Serverless Function.
 *
 * מופע ה-Nest נשמר בין הפעלות (warm start) ואין שמירת State בזיכרון בין בקשות
 * מעבר למופע האפליקציה עצמו - כל מצב עסקי נמצא במסד הנתונים.
 */
type ExpressHandler = (req: IncomingMessage, res: ServerResponse) => void;

let cachedHandler: ExpressHandler | undefined;

async function getHandler(): Promise<ExpressHandler> {
  if (cachedHandler) return cachedHandler;

  const app = await createApp();
  await app.init();

  cachedHandler = app.getHttpAdapter().getInstance() as ExpressHandler;
  return cachedHandler;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const expressApp = await getHandler();
  expressApp(req, res);
}

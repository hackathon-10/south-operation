import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

declare module 'express' {
  interface Request {
    traceId?: string;
  }
}

/**
 * מצרף Trace ID לכל בקשה (§16).
 * ה-ID מוחזר בכותרת ומופיע בכל שגיאה ובלוגים, כדי לאפשר חקירה בלי מידע רגיש.
 */
@Injectable()
export class TraceIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header('x-trace-id');
    // לא סומכים על ערך מהלקוח: מקבלים רק פורמט UUID, אחרת מייצרים חדש.
    const isValid = incoming
      ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(incoming)
      : false;
    const traceId = isValid ? (incoming as string) : randomUUID();

    req.traceId = traceId;
    res.setHeader('x-trace-id', traceId);
    next();
  }
}

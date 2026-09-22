import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';
import { AppException } from '../errors/app.exception';

/**
 * Pipe שמאמת כל קלט מול סכמת Zod.
 *
 * NoCyberHere: INPUT_VALIDATION
 * Threat: Mass assignment, קלט לא צפוי, הזרקת ערכים לשדות רגישים
 * Reason: הסכמות מוגדרות כ-strict, ולכן שדה שלא הוגדר במפורש נדחה (שקול ל-
 *         whitelist + forbidNonWhitelisted), וטיפוסים מומרים בצורה מבוקרת (transform).
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        // מחזירים רק את שם השדה וההודעה בעברית - בלי הערך שנשלח,
        // כדי לא להחזיר ללקוח קלט שעלול להכיל מידע רגיש.
        const details = error.issues.map((issue) => ({
          field: issue.path.join('.') || '(root)',
          message: issue.message,
        }));
        throw new AppException('VALIDATION_FAILED', details);
      }
      throw error;
    }
  }
}

export function zodPipe(schema: ZodSchema): ZodValidationPipe {
  return new ZodValidationPipe(schema);
}

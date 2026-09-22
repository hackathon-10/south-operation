import { Injectable } from '@nestjs/common';
import { hash, verify, Algorithm } from '@node-rs/argon2';

/**
 * NoCyberHere: PASSWORD_HASHING
 * Threat: חשיפת מסד הנתונים וגזירת הסיסמאות ממנו
 * Reason: Argon2id עם פרמטרים מומלצים (OWASP). סיסמה גלויה לעולם אינה נשמרת או נרשמת בלוג.
 */
@Injectable()
export class PasswordService {
  private readonly options = {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19456, // 19 MiB - המלצת OWASP
    timeCost: 2,
    parallelism: 1,
  };

  async hash(plainPassword: string): Promise<string> {
    return hash(plainPassword, this.options);
  }

  /**
   * השוואה בזמן קבוע (מטופלת בתוך argon2).
   * מחזירה false על כל שגיאה במקום לזרוק, כדי לא להדליף מידע על ההאש השמור.
   */
  async verify(passwordHash: string, plainPassword: string): Promise<boolean> {
    try {
      return await verify(passwordHash, plainPassword, this.options);
    } catch {
      return false;
    }
  }
}

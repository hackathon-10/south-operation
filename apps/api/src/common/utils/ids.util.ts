import { randomBytes } from 'node:crypto';
import { FRIENDLY_ID_DIGITS, ID_PREFIX, PACKAGE_TOKEN_BYTES } from '@south/shared';
import type { Prisma } from '@prisma/client';

/**
 * NoCyberHere: SECRET_MANAGEMENT
 * Threat: ניחוש או מנייה של Tokens לסריקת QR (Enumeration / IDOR)
 * Reason: ה-Token נוצר מ-CSPRNG באורך 32 בתים ואינו נגזר ממספר האריזה או מכל נתון עסקי.
 */
export function generatePublicToken(): string {
  return randomBytes(PACKAGE_TOKEN_BYTES).toString('base64url');
}

/**
 * מזהה ידידותי למשתמש נוצר מרצף במסד.
 * הרצף מבטיח ייחודיות גם תחת בקשות מקבילות, בלי לחשוף מידע עסקי.
 *
 * השאילתות כתובות כ-tagged templates קבועים (ולא כ-$queryRawUnsafe),
 * כך שאין שום נתיב שבו קלט משתמש מגיע ל-SQL.
 */
function format(prefix: string, sequence: bigint): string {
  return `${prefix}${String(Number(sequence)).padStart(FRIENDLY_ID_DIGITS, '0')}`;
}

export async function nextPackageNumber(tx: Prisma.TransactionClient): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ value: bigint }>>`SELECT nextval('package_number_seq') AS value`;
  return format(ID_PREFIX.PACKAGE, rows[0].value);
}

export async function nextTaskNumber(tx: Prisma.TransactionClient): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ value: bigint }>>`SELECT nextval('task_number_seq') AS value`;
  return format(ID_PREFIX.TASK, rows[0].value);
}

export async function nextMissionNumber(tx: Prisma.TransactionClient): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ value: bigint }>>`SELECT nextval('mission_number_seq') AS value`;
  return format(ID_PREFIX.MISSION, rows[0].value);
}

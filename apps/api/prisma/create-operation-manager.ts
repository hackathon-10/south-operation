/**
 * יצירת משתמש "מפקד מבצע" בלבד, בלי למחוק דבר.
 *
 * `prisma/seed.ts` מוחק את כל הטבלאות לפני שהוא זורע מחדש, ולכן אינו מתאים
 * למסד שכבר יש בו נתונים אמיתיים. הסקריפט הזה מוסיף משתמש אחד בלבד, והוא
 * Idempotent: הרצה חוזרת מעדכנת את המשתמש הקיים ואינה יוצרת כפילות.
 *
 * הרצה:
 *   npm run create:operation-manager -w @south/api
 *
 * משתני סביבה:
 *   OPERATION_MANAGER_EMAIL     ברירת מחדל: operation@south.demo
 *   OPERATION_MANAGER_PASSWORD  חובה בפרודקשן. אחרת נוצרת סיסמה אקראית ומוצגת פעם אחת.
 *   OPERATION_MANAGER_BASE      קוד הבסיס שאליו הוא משויך. ברירת מחדל: בסיס היעד.
 */
import { randomBytes } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_EMAIL = 'operation@south.demo';
const DEFAULT_DEV_PASSWORD = 'Demo!2345';

async function resolvePassword(): Promise<{ password: string; generated: boolean }> {
  const fromEnv = process.env.OPERATION_MANAGER_PASSWORD;
  if (fromEnv && fromEnv.length >= 8) return { password: fromEnv, generated: false };

  /**
   * NoCyberHere: SECRET_MANAGEMENT
   * Threat: סיסמה קבועה וידועה בסביבת פרודקשן
   * Reason: בפרודקשן לא נופלים לסיסמת ברירת מחדל - נוצרת סיסמה אקראית שמוצגת פעם אחת.
   */
  if (process.env.NODE_ENV === 'production') {
    return { password: randomBytes(12).toString('base64url'), generated: true };
  }
  return { password: DEFAULT_DEV_PASSWORD, generated: false };
}

/** מספר אישי פנוי - לא מתנגש במשתמש קיים. */
async function freeIdentityNumber(): Promise<string> {
  for (let candidate = 9000007; candidate < 9001000; candidate += 1) {
    const taken = await prisma.user.findUnique({
      where: { identityNumber: String(candidate) },
      select: { id: true },
    });
    if (!taken) return String(candidate);
  }
  throw new Error('לא נמצא מספר אישי פנוי בטווח שהוקצה למשתמשי הדגמה.');
}

async function main(): Promise<void> {
  const email = process.env.OPERATION_MANAGER_EMAIL ?? DEFAULT_EMAIL;
  const baseCode = process.env.OPERATION_MANAGER_BASE;

  const base = baseCode
    ? await prisma.base.findUnique({ where: { code: baseCode } })
    : await prisma.base.findFirst({ where: { isDestinationHub: true } });

  if (!base) {
    throw new Error(
      baseCode
        ? `לא נמצא בסיס עם הקוד ${baseCode}. יש להריץ migrations ולוודא שהבסיסים קיימים.`
        : 'לא נמצא בסיס יעד במסד. יש להריץ migrations ו-Seed, או לציין OPERATION_MANAGER_BASE.',
    );
  }

  const { password, generated } = await resolvePassword();
  const passwordHash = await hash(password);

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  const user = existing
    ? await prisma.user.update({
        where: { email },
        data: { role: 'OPERATION_MANAGER', baseId: base.id, teamId: null, isActive: true },
      })
    : await prisma.user.create({
        data: {
          identityNumber: await freeIdentityNumber(),
          fullName: 'אל״ם יואב ברנע',
          email,
          passwordHash,
          role: 'OPERATION_MANAGER',
          baseId: base.id,
          teamId: null,
        },
      });

  console.log('');
  console.log(existing ? 'המשתמש הקיים עודכן:' : 'נוצר משתמש חדש:');
  console.log(`  אימייל:  ${user.email}`);
  console.log(`  שם:      ${user.fullName}`);
  console.log(`  תפקיד:   OPERATION_MANAGER`);
  console.log(`  בסיס:    ${base.name} (${base.code})`);

  if (existing) {
    // עדכון אינו משנה סיסמה קיימת - אין סיבה לאפס סיסמה של משתמש שכבר קיים.
    console.log('  סיסמה:   ללא שינוי (המשתמש כבר היה קיים)');
  } else if (generated) {
    console.log(`  סיסמה:   ${password}   <-- נוצרה אקראית, מוצגת פעם אחת בלבד`);
  } else {
    console.log(`  סיסמה:   ${password}`);
  }
  console.log('');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());

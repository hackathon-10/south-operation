import { PGlite } from '@electric-sql/pglite';
import { PrismaClient } from '@prisma/client';
import { PrismaPGlite } from 'pglite-prisma-adapter';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(__dirname, '..', 'prisma', 'migrations');

/**
 * מסד נתונים אמיתי (PostgreSQL) שרץ בתוך תהליך הבדיקה באמצעות PGlite.
 *
 * כך בדיקות האינטגרציה מריצות את אותן migrations, אותם Foreign Keys
 * ואותם Check Constraints שרצים ב-Supabase - בלי תלות בשרת חיצוני או ב-Docker.
 */
export interface TestDatabase {
  prisma: PrismaClient;
  close: () => Promise<void>;
}

/** פיצול קובץ SQL לפקודות, תוך התעלמות מהערות. */
function splitStatements(sql: string): string[] {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) =>
      statement
        .split(/\r?\n/)
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim(),
    )
    .filter((statement) => statement.length > 0);
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const pglite = new PGlite();
  await pglite.waitReady;

  const migrations = readdirSync(MIGRATIONS_DIR)
    .filter((entry) => !entry.endsWith('.toml'))
    .sort();

  for (const migration of migrations) {
    const sql = readFileSync(join(MIGRATIONS_DIR, migration, 'migration.sql'), 'utf8');
    for (const statement of splitStatements(sql)) {
      await pglite.exec(statement);
    }
  }

  // המרה מפורשת: חבילת ה-Adapter מביאה עותק משלה של טיפוסי driver-adapter-utils,
  // ולכן הטיפוסים אינם זהים למרות שהמימוש תואם. הבדיקות עצמן מאמתות את ההתנהגות.
  const adapter = new PrismaPGlite(pglite);
  const prisma = new PrismaClient({ adapter, log: ['error'] } as never);

  return {
    prisma,
    close: async () => {
      await prisma.$disconnect();
      await pglite.close();
    },
  };
}

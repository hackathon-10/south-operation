/**
 * CLI לקליטת קובץ מיפוי של שלב א׳.
 *
 * שימוש:
 *   npm run import:mapping -w @south/api -- ./docs/samples/mapping-sample.csv
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importMappingCsv } from '../src/modules/inventory/mapping-importer';

async function main(): Promise<void> {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('יש להעביר נתיב לקובץ CSV. לדוגמה: npm run import:mapping -- ./data/mapping.csv');
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient();
  try {
    const csvText = readFileSync(resolve(filePath), 'utf8');
    const result = await importMappingCsv(prisma, csvText);

    console.log('\nסיכום הקליטה:');
    console.table({
      'שורות בקובץ': result.totalRows,
      'שורות שנקלטו': result.importedRows,
      'חדרים חדשים': result.createdRooms,
      'מק״טים חדשים': result.createdCatalogItems,
      'פריטים ייחודיים חדשים': result.createdAssets,
      'שורות מלאי שעודכנו': result.updatedInventoryLines,
      שגיאות: result.errors.length,
    });

    if (result.errors.length > 0) {
      console.log('\nשגיאות:');
      for (const error of result.errors) {
        console.log(`  שורה ${error.line}${error.field ? ` · ${error.field}` : ''}: ${error.message}`);
      }
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();

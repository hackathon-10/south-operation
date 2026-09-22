# HANDOFF — מערכת המעבר דרומה

מסמך העברה לסוכן הפיתוח הבא. נכתב ב-2026-09-22.

**מקור האמת לדרישות:** [`SYSTEM_PROMPT_SOUTH_OPERATION_MVP.md`](SYSTEM_PROMPT_SOUTH_OPERATION_MVP.md) —
לקרוא אותו לפני שינוי כללי עסק. כללי אבטחה מחייבים:
[`.claude/nocyberhere/NoCyberHere.md`](.claude/nocyberhere/NoCyberHere.md)
ו-[`.claude/NoCyber here cr check/SKILL.md`](.claude/NoCyber%20here%20cr%20check/SKILL.md).

---

## 1. מצב נוכחי בשורה אחת

הבק-אנד והפרונט-אנד מלאים ועובדים מקצה לקצה, עם 109 בדיקות עוברות.
**מה שחסר:** תיעוד (README ו-docs), הרצת שער האבטחה NoCyberHere, קונפיג פריסה ל-API ב-Vercel,
והרצה/תיקון של תרחיש ה-Playwright.

---

## 2. איך מריצים עכשיו (בלי Supabase, בלי Docker)

```bash
npm install
npm run demo
```

- API עולה על `http://localhost:3001/api/v1` עם **PostgreSQL בתוך התהליך** (PGlite) ו-Seed מלא.
- Web עולה על `http://localhost:5173`.
- התחברות: `commander@south.demo` / `Demo!2345` (וגם `soldier.gdn@`, `soldier.tzr@`,
  `soldier.kt@`, `teamlead.dev@`, `teamlead.lab@` — כולם באותה סיסמה).

זה מצב הדגמה בלבד (`apps/api/test/e2e-server.ts`). **הרצה אמיתית** מול Supabase:

```bash
cp .env.example apps/api/.env      # למלא DATABASE_URL, DIRECT_URL, סודות JWT
npm run migrate:deploy             # prisma migrate deploy
npm run seed
npm run dev                        # API על 3000, Web על 5173
```

Swagger: `http://localhost:3000/api/docs`.

---

## 3. מה הושלם ואומת בפועל

| שכבה | מצב | אימות שבוצע |
| --- | --- | --- |
| `packages/shared` | הושלם | `npm run test -w @south/shared` → **15 בדיקות עוברות** |
| `apps/api` (NestJS) | הושלם | typecheck נקי, build נקי, `npm run test -w @south/api` → **38 בדיקות יחידה עוברות** |
| בדיקות אינטגרציה API | הושלם | `npm run test:e2e -w @south/api` → **46 בדיקות עוברות** (34 זרימה מלאה + 12 ל-Seed) מול PostgreSQL אמיתי |
| `apps/web` (React) | הושלם | typecheck נקי, `npm run build -w @south/web` נקי, `npm run test -w @south/web` → **25 בדיקות עוברות** |
| מצב הדגמה | עובד | `npm run demo` → health מחזיר `{"status":"ok","database":"up"}`, Web מחזיר 200 |

**סה״כ 124 בדיקות אוטומטיות עוברות** (15 + 38 + 46 + 25).

### מה מכוסה בבדיקות האינטגרציה (הכי חשוב לדעת)
`apps/api/test/app.e2e-spec.ts` מריץ את כל הזרימה של §14 מול מסד אמיתי:
התחברות (כולל אותה הודעת שגיאה למשתמש לא קיים ולסיסמה שגויה) → יצירת משימה עם שריון →
אריזה לפי `assetTag` ולפי כמות → מניעת אריזה כפולה וחריגה מהכמות → סגירה + תווית QR עם Token אקראי →
פתיחה מחדש ועריכה → הצעת מסלול → שליחות מרובת בסיסים עם נסיעה מאובטחת → בקשת הצטרפות ואישור →
העמסה, Idempotency ויציאה → **409 על עריכה אחרי יציאה** → סריקה ללא התחברות (401) ואחריה →
קליטה ופיזור כולל עדכון מלאי היעד → ראש צוות רואה רק את הצוות שלו (כולל ניסיון IDOR ישיר) →
Dashboard, מפה ו-Audit.

---

## 4. מה נשאר לעשות — לפי סדר עדיפות

### עדיפות 1 — חובה לפי האפיון (§18) ולפי סקיל האבטחה

1. **הרצת שער האבטחה NoCyberHere — עוד לא הורץ כלל.**
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\NoCyberHere-Security.ps1 -SkipZap -SkipTrivy
   ```
   לעבור על כל ממצא, לתקן את האמיתיים, לתעד false positives. לצפות ל:
   - `npm audit` — לבדוק high/critical.
   - Gitleaks — `apps/api/.env` מכיל סודות פיתוח אך הוא ב-`.gitignore`; לוודא שלא נכנס ל-git.
   - Semgrep — שימו לב ל-`$executeRaw` ב-`inventory.service.ts` (פרמטרי, תקין).
   לסיום, לדווח בפורמט שהסקיל דורש (PASS/FAIL, בקרות שנוספו, מרקרים, בדיקות, אזהרות שנותרו).

2. **README.md** (§18.6) — מה המוצר עושה, ארכיטקטורה, דרישות מוקדמות, הוראות הרצה,
   פקודות migrate/seed, הגדרת Supabase ופריסה ל-Vercel, **חשבונות דמו וסיסמאות**,
   הסבר תפקידים, תרחיש הדגמה לשופטים, מגבלות MVP. כרגע `README.md` מכיל שורה אחת בלבד.

3. **`docs/architecture.md`** — רכיבים, גבולות מודולים, זרימות. לתעד שם גם שתי החלטות שכבר התקבלו:
   - הסרת אריזה משליחות מחזירה אותה ל-`READY_FOR_SHIPMENT` (ביטול שיבוץ), בעוד
     `ASSIGNED_TO_MISSION → OPEN` מיושם דרך "פתיחה מחדש" — ראו הערה ב-`packages/shared/src/state-machines.ts`.
   - אימות קלט נעשה ב-Zod (משותף ל-API ול-Web) ולא ב-class-validator, בנוסף ל-`ValidationPipe` גלובלי.

4. **`docs/security.md`** — Threats והבקרות. כל הבקרות כבר מסומנות בקוד: `grep -r "NoCyberHere" apps packages`.

5. **`docs/api.md`** — אפשר להסתמך על Swagger ולתת סקירה קצרה + טבלת endpoints.

6. **`docs/samples/mapping-sample.csv`** — קובץ דוגמה לקליטת מיפוי. הפורמט מוגדר ב-
   `packages/shared/src/schemas/import.ts`, והמימוש ב-`apps/api/src/modules/inventory/mapping-importer.ts`
   (יש CLI: `npm run import:mapping -w @south/api -- <path>`). **ה-Importer עדיין לא נבדק בבדיקה אוטומטית** —
   שווה בדיקת אינטגרציה קצרה מול PGlite.

7. **`apps/api/vercel.json`** — עדיין לא נוצר. נקודת הכניסה מוכנה: `apps/api/api/index.ts`.
   ה-`vercel.json` בשורש מוגדר ל-Frontend בלבד. הכוונה: שני Vercel Projects מאותו repo
   (Root Directory `apps/web` ו-`apps/api`).

### עדיפות 2 — השלמת הבדיקות

8. **תרחיש Playwright — נכתב אך לא הורץ.** `e2e/south-operation.spec.ts` + `playwright.config.ts`
   (הקונפיג מרים לבד את שרת ה-API עם PGlite על 3001 ואת ה-Web על 5174).
   התקנת הדפדפן הופסקה באמצע: להריץ `npx playwright install chromium` ואז `npm run test:e2e`.
   **הסלקטורים לא אומתו מול DOM אמיתי — לצפות לתיקונים.** בפרט:
   - בשורות הראשונות של המבחן הראשון יש `expect(...).toContainText(...).catch(() => undefined)` —
     קוד מכוער ולא אפקטיבי, **למחוק אותו**.
   - בחירת ערכים ב-`TextField select` של MUI עשויה לדרוש `page.getByRole('combobox')` במקום `getByLabel`.
   - כפתור "יציאה לדרך" מופיע גם במסך וגם בדיאלוג — הסלקטור `.last()` שברירי.

9. **בדיקות שעדיין חסרות לפי §14:** בדיקת יחידה ל-Importer, ובדיקת Frontend למסך הסריקה
   כולל מצב fallback (כרגע נבדקת רק פונקציית `extractTokenFromScan`).

### עדיפות 3 — ליטוש

10. `npm run lint` מעולם לא הורץ (ESLint 9 flat config ב-`eslint.config.mjs`). לצפות לאזהרות `no-unused-vars`.
11. `apps/api/package.json` עדיין מכיל `db:push` — האפיון מחייב migrations; לשקול הסרה או תיעוד שזה לפרוטוטייפ בלבד.
12. Chunks של `charts` ו-`scanner` הם ~450KB כל אחד (lazy-load אפשרי).
13. **אין עדיין commit ב-git.** העבודה כולה לא מקומטת. `git status` מראה עשרות קבצים חדשים.

---

## 5. ארכיטקטורה — מה צריך לדעת כדי לא לשבור

```
packages/shared   Zod schemas + enums + תוויות עברית + קטלוג שגיאות + מכונות מצבים
apps/api          NestJS 11 + Prisma 6 (PostgreSQL/Supabase)
apps/web          React 18 + Vite 5 + MUI 5 (RTL) + TanStack Query
e2e               Playwright
```

**כללים שנשמרים בקוד ואסור להפר:**

- כל מעבר סטטוס עובר דרך Use Case ייעודי. הגדרות המעברים ב-`packages/shared/src/state-machines.ts`
  והן מקור אמת יחיד לשרת ולממשק.
- כל שינוי מלאי הוא **UPDATE אטומי מותנה** (`apps/api/src/modules/inventory/inventory.service.ts`),
  ולכן אין מרוץ בין שתי בקשות. אין להחליף ב-read-then-write.
- הרשאות ברמת אובייקט מרוכזות ב-`apps/api/src/common/authz/access-control.ts` (פונקציות טהורות, נבדקות ביחידה).
  אין להסתמך על הסתרת כפתורים.
- הודעות שגיאה למשתמש מגיעות מ-`packages/shared/src/errors.ts`. **אסור להציג קוד HTTP למשתמש.**
- ה-QR מכיל רק `publicToken` אקראי (32 בתים). אין להחזיר אותו ברשימות — רק ב-`/packages/:id/label`.
- כל בקרת אבטחה מסומנת `// NoCyberHere: <CONTROL>` עם Threat ו-Reason. לא להסיר בלי להסיר את הבקרה.

---

## 6. עיצוב — מאיפה הוא מגיע

המשתמש סיפק שלושה מסכי השראה (דשבורד, "המשלוחים שלי", "מאגר מכשירים").
שפת העיצוב שנגזרה מהם מתועדת ב-[`docs/design/design-language.md`](docs/design/design-language.md),
וממומשת ב-`apps/web/src/theme/tokens.ts` (מקור אמת יחיד לצבע/רדיוס/צל) ו-`apps/web/src/theme/index.ts`.
**החלפת ערכת צבעים = שינוי בקובץ tokens בלבד.**

- קישור ה-Figma שסופק אינו נגיש (דורש אימות) — אם צריך התאמה מדויקת יותר, לבקש ייצוא PNG ל-`docs/design/`.
- שני דברים מהמסכים לא מומשו **בכוונה**: צ׳אט בוט (מחוץ ל-MVP לפי §4) ומפת לוויין
  (האפיון מחייב מפת חדרים מבוססת נתונים ואוסר מפות/נ״צ רגישים). מתועד בסוף מסמך העיצוב.

---

## 7. מלכודות שכבר נפלנו בהן (לא לחזור עליהן)

1. **Heredoc ב-Bash נחתך סביב ~250 שורות** → קבצי מקור נכתבים עם כלי `Write`, לא עם `cat <<EOF`.
2. **עריכות עם python inline מחזירות את כל הקובץ ל-context** ושורפות תקציב → להשתמש ב-`Edit`.
3. **PGlite דורש `--experimental-vm-modules`** ב-Jest. לכן `test:e2e` קורא ל-jest דרך `node --experimental-vm-modules`.
4. **טיפוסי ה-Adapter של PGlite לא תואמים ל-Prisma 6** (עותק כפול של `driver-adapter-utils`) →
   יש `as never` מתועד ב-`apps/api/test/test-database.ts`. זו בעיית טיפוסים בלבד; הריצה תקינה.
5. `@zxing/browser@0.2.1` דורש `@zxing/library@^0.23` (לא 0.21).
6. ts-jest מנסה לקמפל את `packages/shared/dist/**/*.js` → יש `transformIgnorePatterns` ב-`jest.e2e.config.js`.
7. הגרף בדשבורד הוא **גוון אחד** בכוונה: הוולידטור של סקיל ה-dataviz נכשל על סגול מול כחול
   (ΔE 9.7 — מתחת לסף), והזהות מגיעה מתוויות הציר. לא להחזיר צבע-לכל-סטטוס בגרפים.

---

## 8. פקודות שימושיות

```bash
npm run demo                    # הדגמה מלאה בלי תשתית חיצונית
npm run verify                  # lint + typecheck + test + build (lint עדיין לא נבדק!)
npm run test                    # shared + api + web
npm run test:e2e:api            # 46 בדיקות אינטגרציה מול PostgreSQL בתהליך
npm run test:e2e                # Playwright (דורש npx playwright install chromium)
npm run security                # שער NoCyberHere
npm run seed -w @south/api      # Seed מול DATABASE_URL אמיתי
```

---

## 9. הצעה לסדר העבודה הבא

1. להריץ `npm run demo`, לפתוח את הדפדפן ולעבור על המסכים — לוודא שהכול נראה כמו שצריך.
2. לכתוב README + שלושת מסמכי ה-docs (זה החוסר הגדול ביותר מול §18).
3. להריץ את שער NoCyberHere ולטפל בממצאים.
4. להתקין דפדפן ל-Playwright, להריץ, לתקן סלקטורים.
5. `npm run lint` ולתקן.
6. `apps/api/vercel.json` + אימות פריסה.
7. Commit ראשון מסודר.

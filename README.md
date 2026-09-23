# המעבר דרומה

מערכת לניהול אריזה, שינוע וקליטה של ציוד לוגיסטי (מחשבים, מסכים וציוד נלווה) בזמן פינוי
בסיסים דרומה אל קריית התקשוב. המערכת מחליפה תיאום ידני בטלפון וב-Excel בזרימת עבודה אחת,
מבוקרת ומבוססת סטטוסים: מפקד יוצר משימת אריזה מפורטת → חייל לוגיסטיקה אורז ומפיק לה תווית
QR עם קוד אקראי בלבד → מפקד מרכיב שליחות רב-בסיסית ומקבל הצעת מסלול מוסברת → הנהג יוצא
לדרך → בקריית התקשוב סורקים את ה-QR בלי צורך להזין נתונים ידנית, קולטים ומפזרים את הציוד
לפי מיפוי חדרים אמיתי. לאורך כל הדרך יש למפקד תמונת מצב חיה (Dashboard, מפת חדרים, יומן
פעולות), ולראש צוות תצוגה מצומצמת לציוד ולאריזות של הצוות שלו בלבד.

כל הנתונים במערכת — כולל שמות, בסיסים ומיקומים — הם **נתוני דמה סינתטיים**, שלא מייצגים
מידע מבצעי אמיתי.

## תוכן העניינים

- [ארכיטקטורה](#ארכיטקטורה)
- [דרישות מוקדמות](#דרישות-מוקדמות)
- [הרצה מהירה (הדגמה, בלי תשתית חיצונית)](#הרצה-מהירה-הדגמה-בלי-תשתית-חיצונית)
- [הרצה מול Supabase אמיתי](#הרצה-מול-supabase-אמיתי)
- [Migrations ו-Seed](#migrations-ו-seed)
- [פריסה ל-Vercel](#פריסה-ל-vercel)
- [חשבונות דמו](#חשבונות-דמו)
- [תפקידים במערכת](#תפקידים-במערכת)
- [תרחיש הדגמה מומלץ לשופטים](#תרחיש-הדגמה-מומלץ-לשופטים)
- [בדיקות](#בדיקות)
- [מגבלות ה-MVP](#מגבלות-ה-mvp)
- [תיעוד נוסף](#תיעוד-נוסף)

## ארכיטקטורה

Monorepo מבוסס npm workspaces:

```text
packages/shared   Zod schemas, enums, תוויות עברית, קטלוג שגיאות ומכונות מצבים - מקור
                  אמת יחיד המשותף לשרת ולממשק
apps/api          NestJS 11 + Prisma 6, מול PostgreSQL (Supabase בפרודקשן)
apps/web          React 18 + Vite 5 + MUI 5 (RTL מלא) + TanStack Query
e2e               תרחיש Playwright מקצה לקצה
```

פירוט מלא של הרכיבים, גבולות המודולים והזרימות המרכזיות נמצא ב-
[`docs/architecture.md`](docs/architecture.md).

## דרישות מוקדמות

- Node.js 20 ומעלה, npm 10 ומעלה.
- להרצה מול Supabase: פרויקט Supabase (PostgreSQL) פעיל.
- להרצת בדיקות ה-E2E של Playwright: `npx playwright install chromium` (חד-פעמי).

## הרצה מהירה (הדגמה, בלי תשתית חיצונית)

זו הדרך המהירה ביותר לראות את המערכת פועלת מקצה לקצה - **בלי Supabase ובלי Docker**.
מסד הנתונים רץ בתוך התהליך (PGlite) ונטען מחדש בכל הרצה עם Seed מלא.

```bash
npm install
npm run demo
```

- ה-API עולה על `http://localhost:3001/api/v1`.
- ה-Web עולה על `http://localhost:5173`.
- הפקודה מדפיסה בקונסול את רשימת חשבונות הדמו והסיסמה (ראו גם [חשבונות דמו](#חשבונות-דמו)).

> אם `npm install` מדלג על סקריפטי ההתקנה של Prisma/esbuild (הודעת `install scripts have
> been blocked`), יש לאשר אותם פעם אחת: `npm install-scripts approve @prisma/client
> @prisma/engines prisma esbuild fsevents` ואז `npm rebuild`. בלי זה ה-API ייכשל בעלייה עם
> השגיאה `@prisma/client did not initialize yet`.

## הרצה מול Supabase אמיתי

1. יוצרים פרויקט ב-[Supabase](https://supabase.com) ומעתיקים ממנו את כתובות החיבור.
2. מכינים קובץ סביבה מהתבנית:

   ```bash
   cp .env.example apps/api/.env
   ```

3. ממלאים ב-`apps/api/.env` לפחות את: `DATABASE_URL` ו-`DIRECT_URL` (מדף ה-Database Settings
   של הפרויקט ב-Supabase - חיבור Pooler בפורט 6543 ל-`DATABASE_URL`, חיבור ישיר בפורט 5432
   ל-`DIRECT_URL`), ואת `JWT_ACCESS_SECRET` ו-`JWT_REFRESH_SECRET` (מחרוזות אקראיות באורך
   32+ תווים, לדוגמה `openssl rand -base64 48`). שאר המשתנים ב-`.env.example` מתועדים שם
   בעברית ליד כל ערך.
4. מריצים migrations ו-Seed (ראו [Migrations ו-Seed](#migrations-ו-seed)).
5. מריצים את המערכת:

   ```bash
   npm install
   npm run dev
   ```

   - API על `http://localhost:3000/api/v1`, Swagger על `http://localhost:3000/api/docs`.
   - Web על `http://localhost:5173` (קורא ל-API דרך `VITE_API_BASE_URL` שב-`.env.example`).

## Migrations ו-Seed

```bash
npm run migrate:deploy      # apps/api: prisma migrate deploy - מריץ migrations קיימים
npm run migrate             # apps/api: prisma migrate dev - ליצירת migration חדש בפיתוח
npm run seed                # apps/api: יוצר בסיסים, משתמשי דמו, קטלוג, מפת חדרים ונתוני הדגמה
```

ל-Seed יש גם ייבוא מיפוי חדרים מקובץ CSV חיצוני (ראו דוגמה ב-
[`docs/samples/mapping-sample.csv`](docs/samples/mapping-sample.csv)):

```bash
npm run import:mapping -- path/to/mapping.csv
```

## פריסה ל-Vercel

הפריסה מורכבת משני **פרויקטי Vercel נפרדים מאותו Repository** - זו הדרך הנתמכת
של Vercel לפרוס יותר ממוצר אחד מ-Monorepo (ראו
[Vercel Docs - Monorepos](https://vercel.com/docs/monorepos)). **אין** פקודת
Build יחידה לכל הפרויקט - כל אחד מהשניים הוא פרויקט Vercel נפרד עם ה-Root
Directory שלו:

| פרויקט | Root Directory | קונפיג |
| --- | --- | --- |
| Frontend | `apps/web` | [`apps/web/vercel.json`](apps/web/vercel.json) |
| API | `apps/api` | [`apps/api/vercel.json`](apps/api/vercel.json) |

**נקודה קריטית:** Vercel קורא את `vercel.json` **מתוך ה-Root Directory שהוגדר
לפרויקט**, לא משורש ה-Repository. לכן לכל פרויקט יש `vercel.json` משלו בתוך
התיקייה שלו (לא קובץ אחד משותף בשורש) - אחרת Vercel לא מוצא את הקונפיג,
נופל חזרה לזיהוי אוטומטי של Framework, ומציג שדה Build Command יחיד גנרי
(בדיוק התסמין "זה מצפה לפקודה אחת כמו ב-Next").

שני הפרויקטים בונים מתוך אותו Repository וזקוקים לקבצים שמחוץ ל-Root Directory
שלהם (בעיקר `packages/shared`) - **חובה** להפעיל בהגדרות כל אחד מהפרויקטים:
**Settings → Build and Deployment → Root Directory → Include source files
outside of the Root Directory in the Build Step**. בלי זה ה-Build ייכשל על
"module not found" עבור `@south/shared`.

### הקמה מהדשבורד (פעם אחת לכל פרויקט)

1. **Add New… → Project** → יבוא ה-Repository מ-GitHub.
2. לפני ה-Deploy הראשון: **Edit** ליד Root Directory → לבחור `apps/web` (או
   `apps/api` בפעם השנייה).
3. להפעיל את **Include source files outside of the Root Directory**
   (ראו למעלה).
4. Framework Preset אפשר להשאיר על ברירת המחדל - `vercel.json` שבתוך התיקייה
   כבר מגדיר `framework: null` ודורס את הזיהוי האוטומטי.
5. להוסיף את משתני הסביבה (ראו בהמשך) ולהריץ Deploy.
6. לחזור על 1-5 ליצירת הפרויקט השני מאותו Repository.

### פרויקט ה-API

- Root Directory: `apps/api`.
- `apps/api/vercel.json` מריץ `prisma generate` בזמן ה-Build ומפנה כל בקשה לנקודת הכניסה
  היחידה `apps/api/api/index.ts` (Serverless Function שמריצה את אותה אפליקציית Nest בדיוק
  כמו בהרצה מקומית, כולל כל בקרות האבטחה).
- משתני סביבה נדרשים (Project Settings → Environment Variables): כל המשתנים המפורטים
  ב-[`.env.example`](.env.example) תחת "API", עם `NODE_ENV=production` ו-
  `ENABLE_DEMO_LOGIN=false` (חובה - ראו אזהרה בקוד וב-`docs/security.md`).
  `CORS_ORIGINS` צריך להצביע לכתובת ה-Vercel של ה-Frontend.
- לפני ה-Deploy הראשון יש להריץ `npm run migrate:deploy` מול `DATABASE_URL`/`DIRECT_URL` של
  הסביבה (מקומית או ב-CI) - Vercel עצמו לא מריץ migrations אוטומטית.

### פרויקט ה-Frontend

- Root Directory: `apps/web`.
- `apps/web/vercel.json` בונה עם `npm run build:shared && npm run build -w @south/web`
  (מריץ מ-`cd ../..` בחזרה לשורש ה-Repository כדי לגשת ל-Workspaces) ומגיש את
  `apps/web/dist` כאתר סטטי (SPA fallback ל-`index.html`).
- משתנה סביבה נדרש: `VITE_API_BASE_URL` = כתובת פרויקט ה-API ב-Vercel + `/api/v1`.

## חשבונות דמו

כל חשבונות הדמו (מקומי או לאחר Seed) משתמשים באותה סיסמה: **`Demo!2345`**
(אלא אם הוגדר `SEED_DEMO_PASSWORD` אחר בסביבה - במקרה כזה ה-Seed מדפיס את הסיסמה שנוצרה).

| אימייל | תפקיד | תיאור |
| --- | --- | --- |
| `commander@south.demo` | מפקד לוגיסטיקה | רואה את כל המבצע - כל הבסיסים, כל השליחויות |
| `operation@south.demo` | מפקד מבצע | תמונת מאקרו בלבד: מצב כל הבסיסים והיחידות, קריאה בלבד |
| `soldier.gdn@south.demo` | חייל לוגיסטיקה | אורזת ומשנעת בבסיס גדעונים |
| `soldier.tzr@south.demo` | חייל לוגיסטיקה | אורז ומשנע בבסיס צריפין |
| `soldier.kt@south.demo` | חייל לוגיסטיקה | קולט ומפזר בקריית התקשוב (יעד הפינוי) |
| `teamlead.dev@south.demo` | ראש צוות | רואה רק את האריזות והציוד של צוות הפיתוח שלו |
| `teamlead.lab@south.demo` | ראש צוות | ראשת צוות מעבדה |

מסך ההתחברות בסביבת פיתוח/הדגמה (`ENABLE_DEMO_LOGIN=true`) מציג את רשימת המשתמשים הזו
עם לחיצה שממלאת את הטופס אוטומטית.

## תפקידים במערכת

- **מפקד לוגיסטיקה (`LOGISTICS_COMMANDER`)** - יוצר משימות אריזה, מרכיב שליחויות בין
  מספר בסיסים, מאשר בקשות הצטרפות, ורואה Dashboard, מפת חדרים ויומן פעולות של כל המבצע.
- **מפקד מבצע (`OPERATION_COMMANDER`)** - תפקיד מאקרו. אינו עוסק בשליחות או באריזה
  מסוימת אלא בתמונה הכוללת: התקדמות וחיווי בריאות (ירוק/כתום/אדום) לכל בסיס ולכל יחידה
  ארגונית, בריענון אוטומטי. הרשאותיו הן קריאה בלבד, למעט אישור בקשות הצטרפות לשליחות.
  הניווט שלו דק בכוונה - דשבורד, בקשות הצטרפות ויומן פעולות בלבד.
- **חייל לוגיסטיקה (`LOGISTICS_SOLDIER`)** - מבצע משימות אריזה (בחירת ציוד לפי `assetTag`
  או לפי כמות), סוגר אריזות ומפיק תווית QR, מבצע העמסה/יציאה לדרך, ובקריית התקשוב סורק
  אריזות נכנסות ומפזר אותן לפי מיפוי החדרים.
- **ראש צוות (`TEAM_LEAD`)** - תצוגה מצומצמת: רואה רק אריזות ומשימות של הצוות שלו, ורק
  מחשבים ומסכים ששייכים לאנשי הצוות (זיהוי לפי ID ובעלים, לא לפי מיקום פיזי בלבד).
  ההרשאה נאכפת בשרת ולא רק מוסתרת בממשק - ראו `apps/api/src/common/authz/access-control.ts`.

## תרחיש הדגמה מומלץ לשופטים

מריצים `npm run demo`, נכנסים עם `commander@south.demo`, ועוברים על הזרימה הבאה
(כולה כבר קיימת בנתוני ה-Seed, כך שאפשר גם רק לצפות ולא ליצור מחדש):

1. **Dashboard** - תמונת מצב: כמה משימות פתוחות, אריזות מוכנות לשילוח, שליחות בדרך.
2. **משימות אריזה** → פותחים משימה קיימת, רואים בחירת ציוד לפי `assetTag` (מחשב/מסך
   ספציפי) ולפי כמות (ציוד כללי), עם מניעת חריגה מהכמות המשוריינת.
3. **אריזות** → פותחים אריזה שנסגרה, לוחצים **תווית QR** ורואים שה-QR מכיל Token אקראי
   בלבד (אין בו מספר סידורי או תוכן רגיש).
4. **שליחויות** → פותחים שליחות רב-בסיסית, רואים את הצעת המסלול המוסברת ואת הסימון
   "נסיעה מאובטחת" (מוצג רק למשתמשים מורשים).
5. מתנתקים ונכנסים עם `soldier.kt@south.demo` (קריית התקשוב) → **סריקת QR** → סורקים
   קוד מאריזה שהגיעה → קליטה ופיזור לפי חדר.
6. מתנתקים ונכנסים עם `teamlead.dev@south.demo` → מראים שרואים רק את הצוות שלו, כולל
   ניסיון (שנכשל בשרת) לצפות באריזה של צוות אחר ישירות ב-URL (IDOR מנוטרל).
7. חוזרים ל-`commander@south.demo` → **מפת חדרים** → לחיצה על חדר מציגה את הציוד האמיתי
   ששובץ אליו, ו-**יומן פעולות** לביקורת מלאה.

כל השלב הזה כבר מכוסה גם בבדיקת האינטגרציה האוטומטית (`apps/api/test/app.e2e-spec.ts`)
ובתרחיש ה-Playwright (`e2e/south-operation.spec.ts`).

## בדיקות

```bash
npm run test            # יחידה: packages/shared + apps/api + apps/web
npm run test:e2e:api    # אינטגרציה: 46 בדיקות מול PostgreSQL אמיתי בתוך התהליך (PGlite)
npm run test:e2e        # Playwright מקצה לקצה (דורש npx playwright install chromium)
npm run lint            # ESLint על שלושת ה-workspaces
npm run typecheck       # בדיקת טיפוסים (Nest + React)
npm run verify          # lint + typecheck + test + build - הכל ביחד
npm run security        # שער האבטחה NoCyberHere (PowerShell - ראו docs/security.md)
```

מצב נכון לרגע כתיבת מסמך זה (הרצה בפועל, לא הערכה): 15 בדיקות ב-`shared`, 38 יחידה +
51 אינטגרציה ב-`api` (כולל 5 בדיקות ל-Importer של מיפוי CSV), 25 ב-`web` ו-3 תרחישי
Playwright מקצה לקצה - **סה"כ 132 בדיקות אוטומטיות עוברות**. `npm run lint` ו-
`npm run typecheck` נקיים לחלוטין. דו"ח ה-NoCyberHere מתועד ב-`docs/security.md`.

## מגבלות ה-MVP

- **בלי צ'אט בוט** - מחוץ לגבולות ה-MVP; לא מומש בכוונה.
- **בלי מפת לוויין/מפה גאוגרפית** - האפיון אוסר חשיפת נקודות ציון או מפות מסווגות. במקום
  זה מומשה מפת חדרים אינטראקטיבית מבוססת נתונים (SVG) לחמש קומות.
- **בלי טיפול ב-Offline או הודעות SMS** - כל פעולה דורשת חיבור לרשת בזמן אמת.
- **בלי תכנון קיבולת (Capacity Planning)** אוטומטי - הצעת המסלול מסבירה את עצמה אך אינה
  מבצעת אופטימיזציה שלא ניתנת להסבר למפקד.
- **התחברות דמו (`ENABLE_DEMO_LOGIN`)** מיועדת לפיתוח/הדגמה בלבד וחייבת להיות כבויה
  בפרודקשן אמיתית.
- מסך ה-Seed ומצב ההדגמה (`npm run demo`) יוצרים ומוחקים נתונים בכל הרצה - אינם מיועדים
  לשימוש מול נתונים אמיתיים.

פירוט הרחבות ועיצוב שלא מומשו במכוון נמצא גם ב-
[`docs/design/design-language.md`](docs/design/design-language.md#7-מה-לא-מומש-מהמסכים).

## תיעוד נוסף

- [`docs/architecture.md`](docs/architecture.md) - רכיבים, גבולות מודולים וזרימות מרכזיות.
- [`docs/security.md`](docs/security.md) - Threats מרכזיים והבקרות שמומשו.
- [`docs/api.md`](docs/api.md) - סקירת ה-API (הפירוט המלא ב-Swagger, `/api/docs`).
- [`docs/design/design-language.md`](docs/design/design-language.md) - שפת העיצוב.
- [`SYSTEM_PROMPT_SOUTH_OPERATION_MVP.md`](SYSTEM_PROMPT_SOUTH_OPERATION_MVP.md) - מקור
  האמת המלא לדרישות המוצר.

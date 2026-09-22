# אבטחת מידע

מסמך זה מתעד את איומי האבטחה המרכזיים שנבחנו והבקרות שמומשו נגדם, בהתאם לדרישות
[`SYSTEM_PROMPT_SOUTH_OPERATION_MVP.md`](../SYSTEM_PROMPT_SOUTH_OPERATION_MVP.md) ולשער
האבטחה `NoCyberHere` (`.claude/nocyberhere/NoCyberHere.md`).

כל בקרת אבטחה מסומנת בקוד עצמו בתגית `NoCyberHere: <CONTROL>` עם `Threat:` ו-`Reason:`
צמודים, כדי שהבקרה תישאר גלויה ולא תוסר בטעות. איתור כל הבקרות בקוד:

```bash
grep -rn "NoCyberHere:" apps packages
```

## 1. סיווג הנתונים

כל הנתונים במערכת - כולל שמות אנשים, בסיסים, חדרים ומיקומים - הם **נתוני דמה
סינתטיים**. אין ולא יהיה במערכת מידע מבצעי אמיתי, קואורדינטות רגישות או תמונות של
מתקנים אמיתיים. זו דרישת בסיס של האפיון (§4, §21) ולא רק החלטת עיצוב.

## 2. איומים מרכזיים ובקרות

### 2.1 אימות (Authentication)

- **איום:** גניבת Access Token דרך XSS, או השתלטות על חשבון דרך ניחוש סיסמה.
- **בקרות:**
  - סיסמאות נשמרות עם **Argon2id** בפרמטרים לפי המלצת OWASP (`memoryCost=19456`,
    `timeCost=2`, `parallelism=1`) - `apps/api/src/modules/auth/password.service.ts`.
    השוואת הסיסמה מתבצעת תמיד דרך `argon2.verify` (זמן קבוע); שגיאה כלשהי מוחזרת כ-`false`
    ולא נזרקת, כדי לא להדליף מידע על ה-hash השמור.
  - הודעת השגיאה בהתחברות **זהה** למשתמש שלא קיים ולסיסמה שגויה (`INVALID_CREDENTIALS`)
    - כדי לא לאפשר User Enumeration. מכוסה בבדיקת אינטגרציה.
  - **Access Token** (JWT, ברירת מחדל 15 דקות) נשמר בזיכרון הדפדפן בלבד ונשלח בכותרת
    `Authorization`, **לעולם לא ב-`localStorage`**.
  - **Refresh Token** (JWT, ברירת מחדל 7 ימים) נשמר ב-cookie `HttpOnly`, `Secure`
    בפרודקשן, `SameSite=Strict` (`Lax` בפיתוח בלבד, בגלל פורטים שונים), עם `path`
    מוגבל ל-`/api/v1/auth` - כך שגם אם יש XSS במקום אחר באפליקציה, ה-cookie לא נגיש
    ל-JavaScript וגם לא נשלח לנתיבים אחרים. ראו `apps/api/src/modules/auth/auth.controller.ts`.
  - **CSRF:** מאחר שה-Access Token נשלח בכותרת `Authorization` (ולא רק דרך cookie),
    בקשת CSRF חוצת-אתר לא יכולה לבצע פעולות בשם המשתמש גם אם ה-cookie נשלח אוטומטית.
  - **נמצא ותוקן במהלך הכנת השער:** `apps/api/test/e2e-server.ts` (שרת ההדגמה
    ו-Playwright) בנה את אפליקציית Nest ידנית במקום דרך `createApp()` המשותף,
    ולכן לא רשם בכלל `cookie-parser`. בפועל `request.cookies` היה תמיד `undefined`,
    `/auth/refresh` נכשל תמיד עם `INVALID_REFRESH_TOKEN`, וכל רענון דף (לא ניווט
    פנימי בתוך ה-SPA) ניתק את המשתמש בשקט - בדיוק התרחיש שהתיעוד ב-`AuthContext.tsx`
    טוען שהוא פותר. תוקן על ידי חילוץ כל הגדרת האבטחה (`helmet`, `cookie-parser`,
    `ValidationPipe`, CORS, Filters) לפונקציה משותפת `configureApp()` ב-`bootstrap.ts`
    שגם `createApp()` וגם `e2e-server.ts` קוראים לה - כך שלא ניתן יותר שסביבה אחת
    תדלג בטעות על בקרת אבטחה שקיימת בשנייה. אומת מחדש ידנית (`curl` login → refresh)
    ובאמצעות תרחיש ה-Playwright המלא (ראו §4).

### 2.2 הרשאות (Authorization) ו-IDOR/BOLA

- **איום:** משתמש משנה מזהה ב-URL (`/packages/{id}`) כדי לצפות/לערוך אובייקט ששייך
  למשתמש או לצוות אחר (Insecure Direct Object Reference).
- **בקרות:**
  - כל בדיקת הרשאה ברמת אובייקט מרוכזת בקובץ אחד -
    `apps/api/src/common/authz/access-control.ts` - פונקציות טהורות שמקבלות את המשתמש
    ואת ה-Scope של האובייקט (`teamId`, `sourceBaseId`, `assignedSoldierId` וכו')
    ומחזירות `boolean`. נבדקות ביחידה בנפרד מה-Controllers.
  - **אסור להסתמך על הסתרת כפתורים בממשק** - כל פעולה נבדקת מחדש בשרת, כולל כשהבקשה
    מגיעה ישירות ל-API בלי דרך הממשק.
  - מכוסה בבדיקת אינטגרציה ייעודית: ראש צוות מנסה לגשת ישירות (דרך URL) לאריזה של
    צוות אחר ומקבל 403/404 (לא נחשף האם האובייקט קיים בכלל).
  - QR של אריזה דורש התחברות פעילה **וגם** הרשאת צפייה על אותה אריזה - סריקה בלי
    התחברות מקבלת 401, לא נתוני האריזה.

### 2.3 QR ומזהים

- **איום:** חשיפת מידע רגיש על תווית מודפסת (עלולה ללכת לאיבוד/להיצפות), או ניחוש
  Token של אריזה אחרת דרך מזהה רציף.
- **בקרות:**
  - ה-QR מכיל **רק** `publicToken` אקראי (32 בייט מ-`crypto.randomBytes`, מקודד
    base64url - `apps/api/src/common/utils/ids.util.ts`) בתוך כתובת סריקה. **אין**
    בו מספר סידורי, תוכן האריזה, שם חייל או מיקום.
  - ה-`publicToken` לא מוחזר בשום רשימה או תשובת API אחרת - הוא מוצג רק בנקודת הקצה
    הייעודית להפקת התווית (`/packages/{id}/label`), אחרי בדיקת הרשאה.
  - מזהים ידידותיים למשתמש (`PKG-10425`, `TSK-00107`) מבוססים רצף פנימי לתצוגה בלבד,
    ולא ניתנים לשימוש כ-Token סריקה - סריקה מאמתת רק מול `publicToken`.
  - נתיב הסריקה מוגבל בקצב (`RATE_LIMITING`, סעיף 2.5) כהגנה נוספת נגד ניסיון ניחוש
    Tokens בכוח גס, מעבר לכך שהם אקראיים ב-32 בייט (בלתי אפשרי בפועל לנחש).

### 2.4 קלט (Input Validation) ו-Mass Assignment

- **איום:** שליחת שדות לא צפויים בגוף הבקשה (למשל שינוי `role` או `id` של אובייקט אחר),
  או ערכי סטטוס חופשיים שלא תואמים את מכונת המצבים.
- **בקרות:**
  - אימות ראשי בכל נקודת קצה נעשה בסכמות **Zod strict**, משותפות בין שרת לממשק
    (`packages/shared/src/schemas`).
  - שכבת הגנה נוספת: `ValidationPipe` גלובלי עם `whitelist: true` +
    `forbidNonWhitelisted: true` - כל שדה שלא מוגדר ב-DTO נדחה, לא רק מתעלם ממנו.
  - סטטוסים הם תמיד `enum` (`packages/shared/src/enums.ts`) ולא מחרוזת חופשית; מעבר
    בין סטטוסים נבדק מול `state-machines.ts` (ראו `docs/architecture.md`), ולא נסמך
    על מה שהלקוח שלח כ"סטטוס הבא".

### 2.5 הגבלת קצב (Rate Limiting)

- **איום:** Brute force על התחברות, Enumeration של משתמשים/Tokens, עומס יתר על ה-API.
- **בקרות** (`apps/api/src/app.module.ts`, `@nestjs/throttler`):
  - מגבלה גלובלית: 240 בקשות לדקה לכל IP.
  - התחברות (`/auth/login`): 10 ניסיונות ל-15 דקות.
  - רענון טוקן (`/auth/refresh`): 60 ל-15 דקות.
  - סריקת QR (`/packages/scan/:publicToken`): 60 לדקה.

### 2.6 כותרות אבטחה ו-CORS

- **בקרות** (`apps/api/src/bootstrap.ts`, Helmet):
  - Content-Security-Policy מפורש (`default-src 'self'`, בלי `unsafe-eval`,
    `object-src 'none'`, `frame-ancestors 'none'`) - לא נסמכים על ברירת המחדל של Helmet.
  - `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-site`.
  - CORS עם רשימת Origins מפורשת מהסביבה (`CORS_ORIGINS`) ו-`credentials: true` - **אין**
    `*` בייצור.
  - ב-Vercel נוספות גם כותרות ברמת ה-Edge (`X-Content-Type-Options`, `X-Frame-Options`,
    `Permissions-Policy`) - ראו `apps/web/vercel.json` ו-`apps/api/vercel.json`.

### 2.7 גישה למסד נתונים (SQL Injection)

- **איום:** הזרקת SQL דרך ערכים מהמשתמש.
- **בקרות:** כל הגישה למסד עוברת דרך Prisma. שאילתות ה-`$executeRaw` היחידות בקוד
  (עדכוני מלאי אטומיים, `apps/api/src/modules/inventory/inventory.service.ts`) הן
  Tagged Templates של Prisma - כל ערך מהמשתמש עובר כפרמטר מוכן (`$1`, `$2`...), **לא**
  כשרשור מחרוזות. נבדק גם ב-Semgrep כחלק משער ה-NoCyberHere.

### 2.8 חשיפת מידע בשגיאות ובלוגים

- **איום:** דליפת Stack Trace, שם טבלה או פרטי חיבור למסד ללקוח; כתיבת סיסמה/Token ללוג.
- **בקרות:**
  - `AllExceptionsFilter` מתרגם כל שגיאה לפורמט אחיד עם קוד והודעה אנושית בעברית
    (`packages/shared/src/errors.ts`) - **הלקוח לעולם לא רואה קוד HTTP גולמי או
    Stack Trace**; הפרטים הטכניים נכתבים ללוג השרת בלבד, עם `traceId` לצורך מעקב.
  - שגיאות 401/403/429 נרשמות ללוג (`SECURITY_LOGGING`) בלי סיסמאות או Tokens.
  - כל אובייקט שנכתב ל-Audit Log או ללוג עובר `redact` (`apps/api/src/common/logging/redact.ts`)
    שמחליף שדות רגישים ב-`[redacted]` לפני הכתיבה.

### 2.9 יומן ביקורת (Audit Log)

- **איום:** אי-יכולת לחקור מי שינה מה ומתי אחרי אירוע.
- **בקרות:** `AuditModule` מתעד פעולות משמעותיות (יצירת/שינוי משימה, סגירת אריזה, שיוך/
  ביטול שיוך לשליחות, אישור/דחיית בקשת הצטרפות וכו') עם מזהה משתמש וזמן. **לא** נשמרים
  סיסמאות, Tokens או מידע אישי מלא בתוך רשומת ה-Audit עצמה. זמין לצפייה למפקד בלבד.

### 2.10 ניהול סודות (Secret Management)

- **איום:** חשיפת סודות (JWT secrets, חיבור למסד) דרך קוד המקור.
- **בקרות:**
  - כל הסודות מגיעים ממשתני סביבה בלבד; `.env.example` מכיל רק ערכי דוגמה/placeholder,
    ללא סוד אמיתי כלשהו.
  - `apps/api/.env` (המכיל סודות פיתוח מקומיים בפועל) נמצא ב-`.gitignore` ואינו נכנס
    ל-Git - **יש לוודא זאת גם ידנית לפני כל commit** (`git status` לא אמור להראות
    אותו; Gitleaks בשער ה-NoCyberHere בודק זאת אוטומטית).
  - `ENABLE_DEMO_LOGIN` (מציג רשימת משתמשי דמו במסך ההתחברות) חייב להיות `false`
    בפרודקשן אמיתית - הקוד מדפיס אזהרה מפורשת ללוג אם הוא דלוק יחד עם
    `NODE_ENV=production`.

## 3. מה במפורש **לא** בתוך גבולות ה-MVP

לפי §4 ו-§21 באפיון, הדברים הבאים אינם דרישת אבטחה שהמערכת פותרת ואין להציג אותם
כאילו כן: הצפנה ברמת שדה במסד (Supabase מספק הצפנה במנוחה ברמת התשתית), ניהול מפתחות
(KMS), 2FA/MFA, וסריקת פגיעויות רציפה (CI). אלה שיפורים סבירים להמשך, לא רגרסיה במה
שהובטח.

## 4. הרצת שער האבטחה

```bash
npm run security   # מריץ scripts/NoCyberHere-Security.ps1 (PowerShell)
```

הסקריפט הרשמי הוא PowerShell (`scripts/NoCyberHere-Security.ps1`), לשימוש בסביבת
Windows. בסביבת הפיתוח הנוכחית (macOS, בלי PowerShell/Gitleaks/Homebrew מותקנים
מראש) הורצו באופן שקול ישירות שלושת הכלים שהסקריפט עוטף, כדי לא לדלג על שער האבטחה:

### תוצאת ההרצה - 2026-09-22

**NoCyberHere: PASS**

| כלי | תחליף שהורץ בפועל | תוצאה |
| --- | --- | --- |
| `npm audit` | `npm audit` (ישיר) | ראו טבלת ממצאים למטה |
| Semgrep | `semgrep --config=auto --config=p/owasp-top-ten --config=p/secrets` (הותקן דרך `pip3 install --user semgrep`) | **0 ממצאים** מתוך 232 חוקים על 164 קבצים |
| Gitleaks | `detect-secrets scan --all-files` (הותקן דרך `pip3 install --user detect-secrets`, Gitleaks עצמו דורש Homebrew/Go שלא היו זמינים) | 15 "ממצאים" - **כולם False Positive מתועדים** (ראו למטה) |

#### npm audit

לפני התיקון: 19 חולשות (2 low, 6 moderate, 10 high, 1 critical). לאחר בדיקת נגישות
(reachability) לכל חולשה בנפרד:

| חבילה | חומרה | נגיש בפועל? | פעולה |
| --- | --- | --- | --- |
| `axios` 1.7.9 → **1.20.0** | high | כן - נעשה בו שימוש ישיר ב-`apps/web/src/api/client.ts` | **תוקן** - שדרוג לא-Breaking בתוך 1.x |
| `csv-parse` 5.6.0 → **7.0.2** | moderate | כן - מפרש קובצי CSV חיצוניים ב-`mapping-importer.ts` (בדיוק הנתיב הפגיע: `columns: true`) | **תוקן** - שדרוג Major, אומת מול 5 בדיקות אינטגרציה ל-Importer (`test/mapping-importer.e2e-spec.ts`) ומול כל 129 הבדיקות האחרות - כולן עוברות |
| `multer` (טרנזיטיבי, `@nestjs/platform-express`) | high | **לא** - נבדק ואומת שאין אף Route עם `FileInterceptor`/`@UploadedFile` בקוד | התקבל כסיכון שיורי; שדרוג דורש מעבר גרסת מייג'ור של NestJS |
| `react-router`/`react-router-dom` 6.30.6 | moderate | חלקית - Open Redirect ב-`Link`/`useNavigate` עם `\` מובילה; כל יעדי הניווט באפליקציה סטטיים (לא נבנים מקלט משתמש) | התקבל כסיכון שיורי בעדיפות נמוכה; שדרוג ל-v7 הוא Breaking Change רחב (מיגרציה לכל ~20 המסכים) |
| `esbuild`/`vite`/`vite-node`/`vitest`/`@vitest/mocker` (critical/high/moderate) | - | **לא** - כלי Build/Test בזמן פיתוח בלבד; לא נשלחים ל-Production Bundle; שרת ה-Dev מאזין ל-localhost בלבד | התקבל כסיכון שיורי; שדרוג דורש מעבר ל-Vite 8 (Breaking) |
| `deepmerge-ts`/`@prisma/config`/`prisma` (טרנזיטיבי) | high | **לא** - נצרך רק על ידי כלי ה-CLI של Prisma, לא בקוד האפליקציה בזמן ריצה | התקבל כסיכון שיורי |
| `eslint`/`@eslint/plugin-kit` | low | **לא** - כלי Lint בזמן פיתוח בלבד | התקבל כסיכון שיורי |

לאחר התיקונים: **17 חולשות נותרות (2 low, 5 moderate, 9 high, 1 critical), כולן ב-
Dev/Build tooling או בנתיב קוד לא נגיש**, מתועדות ומוצדקות בטבלה למעלה - לא הושתקו
בלי סיבה, בהתאם לדרישת ה-SKILL. `npm run verify` (lint + typecheck + test + build)
עבר במלואו אחרי השדרוגים.

#### Semgrep

0 ממצאים. כולל בדיקה ממוקדת של `$executeRaw` ב-`inventory.service.ts` (Tagged
Template פרמטרי - תקין, כפי שגם `HANDOFF.md` ציין מראש).

#### סריקת סודות (Gitleaks/detect-secrets) - 15 ממצאים, כולם False Positive

כל הממצאים הם אחד משלושת הדברים הבאים, ואומתו ידנית אחד-אחד:

1. **`.env.example`** (3 ממצאים) - ערכי Placeholder מפורשים
   (`PASSWORD@aws-0-...`, `replace-with-a-long-random-string...`) - לא סוד אמיתי.
2. **סיסמת הדמו `Demo!2345`** (ברוב הממצאים - `seed.ts`, `fixtures.ts`,
   `e2e-server.ts`, `seed.e2e-spec.ts`, `playwright.config.ts`,
   `LoginPage.test.tsx`, `south-operation.spec.ts`, `shared.test.ts`) - סיסמת
   דמו סינתטית שכבר מפורסמת בגלוי ב-README ומיועדת אך ורק למשתמשי הדגמה
   שאינם קיימים במציאות.
3. **סודות JWT קבועים לבדיקות בלבד** (`global-setup.ts`, `app.e2e-spec.ts`) -
   `'test-access-secret-that-is-long-enough-32-chars'` וכדומה - משמשים רק
   בתהליך ה-Test Runner המקומי, לעולם לא בסביבה אמיתית.

**וידוא נוסף:** `apps/api/.env` (שבו יהיו סודות אמיתיים בהרצה מול Supabase) **אינו
קיים בהיסטוריית ה-Git** ומאומת כמכוסה על ידי `.gitignore` (`git check-ignore -v`).

#### ממצא נוסף שתוקן תוך כדי הכנת השער: `node_modules` היה עוקב (Tracked) ב-Git

`.gitignore` המקורי הכיל `/node_modules` (עם `/` מוביל - תואם רק את התיקייה
בשורש הריפו). ב-Monorepo מבוסס npm workspaces יש גם `apps/api/node_modules` ו-
`apps/web/node_modules`, ואלה נכנסו ל-Git בטעות (671 קבצים, ~57MB, כולל בינארי
Prisma Engine למספר פלטפורמות). תוקן: השינוי ל-`node_modules/` (ללא `/` מוביל,
תואם בכל עומק) ו-`git rm -r --cached` לקבצים שכבר נכנסו. זה לא היה סוד שדלף, אבל
זה בדיוק סוג התקלה שגורמת בטעות לדליפת סוד מקומי (כל מה שנמצא תחת `node_modules`
נכנס ל-Git בלי סינון) - ולכן מתועד כאן ולא רק כ"ניקיון".

### Summary לפי פורמט הסקיל

```text
Security:
- NoCyberHere: PASS
- Security controls added: 0 בקרות חדשות, אך תוקן פער אמיתי בבקרת AUTHENTICATION
  הקיימת - cookie-parser חסר בשרת ההדגמה/Playwright שגרם לרענון Refresh Token
  להיכשל תמיד (ראו 2.1). 12 הבקרות האחרות אומתו ונשארו שלמות.
- NoCyberHere markers added: 0 (הבקרות הקיימות רוכזו לפונקציה משותפת אחת -
  configureApp() ב-bootstrap.ts - כדי שסביבות שונות לא יוכלו לדלג עליהן בטעות)
- Security tests added: 5 (apps/api/test/mapping-importer.e2e-spec.ts - מכסה גם את
  הקלט שדרכו עברה חולשת csv-parse שתוקנה); תרחיש ה-Playwright המלא (3 בדיקות) גם
  עבר מקצה לקצה כולל login → refresh אמיתי, ומאמת בפועל שהתיקון ל-cookie-parser עבד
- Remaining warnings: 17 חולשות npm audit, כולן ב-Dev/Build tooling או בקוד לא
  נגיש (טבלה מלאה למעלה) - לא "המערכת מאובטחת", אלא בדיוק מה שנבדק ומה שנמצא.
```

# ארכיטקטורה

מסמך זה מתעד את הרכיבים, גבולות המודולים והזרימות המרכזיות של מערכת "המעבר דרומה".
לסקירת מוצר, הרצה ופריסה ראו [`README.md`](../README.md). לשפת העיצוב ראו
[`docs/design/design-language.md`](design/design-language.md). לבקרות אבטחה ראו
[`docs/security.md`](security.md).

## 1. תמונה כללית

```text
packages/shared   Zod schemas, enums, תוויות עברית, קטלוג שגיאות ומכונות מצבים
apps/api          NestJS 11 + Prisma 6, מול PostgreSQL (Supabase בפרודקשן)
apps/web          React 18 + Vite 5 + MUI 5 (RTL) + TanStack Query
e2e               תרחיש Playwright מקצה לקצה
```

`packages/shared` הוא מקור האמת היחיד לכל דבר שחייב להיות זהה בשרת ובממשק: שמות סטטוסים,
המעברים המותרים ביניהם, תוויות בעברית להצגה, וקטלוג קודי השגיאה. גם ה-API וגם ה-Web
מייבאים ממנו ישירות (`@south/shared`) - אין הגדרה כפולה של Enum או של הודעת שגיאה.

## 2. Backend (`apps/api`)

### 2.1 מודולים

```text
AuthModule          התחברות, רענון טוקן, התנתקות, רשימת משתמשי דמו
UsersModule         משתמשים ותפקידים
OrganizationModule  בסיסים, יחידות, צוותים, חדרים ומפות קומות
CatalogModule       קטלוג מוצרים, מחשבים ומסכים (Assets)
InventoryModule     מלאי חדרים ושריונים (לא מוחשף כ-REST עצמאי - נצרך ע"י המודולים האחרים)
PackingTasksModule  משימות אריזה
PackagesModule      אריזות, תכולה, QR וסריקה
MissionsModule      שליחויות, עצירות, מסלול, בקשות הצטרפות
DashboardModule     תמונת מצב לפי תפקיד
AuditModule         יומן פעולות
HealthModule        בדיקת חיות (`/api/v1/health`)
```

כל מודול מחולק ל-`*.controller.ts` (HTTP + Swagger + DTO validation), `*.service.ts`
(לוגיקה עסקית) ולעיתים `*.mapper.ts` (המרת Entity ל-DTO כדי לא לדלוף שדות פנימיים
כלפי חוץ - למשל `publicToken` של אריזה, ראו [security.md](security.md)).

**כלל מחייב:** לוגיקת State Machine, שריון מלאי ושינוי מלאי נמצאת אך ורק ב-Domain
Services (למשל `InventoryService`, `PackagesService`) ולא ב-Controllers. ה-Controllers
מאמתים קלט, אוכפים הרשאה ומעבירים הלאה.

### 2.2 גישה למסד ואטומיות

כל הגישה למסד עוברת דרך Prisma. שינוי מלאי הוא **תמיד** עדכון אטומי מותנה - התנאי העסקי
נבדק בתוך משפט ה-`UPDATE` עצמו, כך שאין חלון מרוץ בין קריאה לכתיבה:

```sql
UPDATE "RoomInventory"
SET "reservedQuantity" = "reservedQuantity" + $quantity
WHERE "roomId" = $roomId
  AND "productCatalogItemId" = $productCatalogItemId
  AND "mappedQuantity" - "reservedQuantity" - "packedQuantity" >= $quantity
```

אם אף שורה לא עודכנה (`updated !== 1`), השירות זורק שגיאת "אין מספיק מלאי" - אין קריאה
נפרדת שמחליטה מראש אם יש מספיק, כי בין הקריאה לכתיבה בקשה מקבילה יכולה לשנות את המצב.
ראו `apps/api/src/modules/inventory/inventory.service.ts`.

### 2.3 הרשאות ברמת אובייקט

הרשאה ברמת אובייקט (מי מותר לו לראות/לערוך אריזה, משימה או שליחות ספציפית) מרוכזת
ב-`apps/api/src/common/authz/access-control.ts` - קובץ אחד של פונקציות טהורות
(`canViewPackage`, `canEditPackage`, `canViewTask` וכו') שמקבלות את המשתמש המחובר ואת
ה-Scope של האובייקט (למשל `teamId`, `sourceBaseId`, `assignedSoldierId`) ומחזירות
`boolean`. הפונקציות האלה נבדקות ביחידה בנפרד מה-Controllers, כדי שכלל ההרשאה יהיה
גלוי וניתן לביקורת. **אסור להסתמך על הסתרת כפתורים בממשק** - כל בדיקה חוזרת גם בשרת.

דוגמה למדיניות: ראש צוות (`TEAM_LEAD`) רואה משימה/אריזה רק אם ה-`teamId` שלה תואם לצוות
שהוא מוביל; חייל לוגיסטיקה (`LOGISTICS_SOLDIER`) רואה משימה שהוא משויך אליה או שמקור/יעד
המשימה הוא הבסיס שלו; מפקד (`LOGISTICS_COMMANDER`) רואה הכל.

### 2.4 אימות (Authentication)

- **Access Token** - JWT קצר-טווח (ברירת מחדל 15 דקות), נשמר בזיכרון בצד הלקוח בלבד
  (לא ב-`localStorage`) ונשלח בכותרת `Authorization: Bearer`.
- **Refresh Token** - JWT ארוך-טווח (ברירת מחדל 7 ימים), נשמר ב-cookie מסוג `HttpOnly`,
  `Secure` (בפרודקשן) ו-`SameSite=Strict`/`Lax`, עם `path` מוגבל ל-`/api/v1/auth` בלבד.
  בעליית האפליקציה בדפדפן מתבצע ניסיון רענון שקט מתוך ה-cookie, כך שרענון דף לא מנתק
  משתמש, וה-Access Token עצמו אף פעם לא נכתב ל-storage נגיש ל-JavaScript של דפים אחרים.
- סיסמאות נשמרות עם Argon2id (פרמטרי OWASP). ראו פירוט מלא ב-[security.md](security.md).

### 2.5 מכונות מצבים (State Machines)

מוגדרות פעם אחת ב-`packages/shared/src/state-machines.ts` ונאכפות בשרת דרך
`canTransitionPackage` / `canTransitionTask` / `canTransitionMission` /
`canTransitionJoinRequest`. הממשק משתמש באותן פונקציות רק כדי להחליט אילו כפתורים
להציג - לא כדי לאכוף.

**אריזה (`PackageStatus`):**

```text
OPEN → SEALED → READY_FOR_SHIPMENT → ASSIGNED_TO_MISSION → IN_TRANSIT
     → RECEIVED_AT_HUB → DELIVERED_TO_ROOM
```

שתי החלטות עיצוב שכדאי לדעת עליהן:

1. **הסרת אריזה משליחות** (`ASSIGNED_TO_MISSION → READY_FOR_SHIPMENT`) היא ביטול שיבוץ
   בלבד - האריזה נשארת סגורה ומאומתת (ה-QR שלה כבר תקף) וחוזרת לבריכת האריזות המוכנות
   לשילוח. היא **לא** "נפתחת מחדש" ותכולתה לא ניתנת לעריכה במצב הזה.
2. **פתיחה מחדש** (`SEALED → OPEN` וגם `READY_FOR_SHIPMENT → OPEN`) היא פעולה נפרדת
   ומפורשת שמחזירה את האריזה לעריכת תכולה. היא זמינה כל עוד האריזה לא שויכה לשליחות
   שיצאה לדרך - ראו `isPackageLocked` / `isPackageContentEditable` באותו קובץ.

אריזה נעולה לחלוטין (לא ניתנת לעריכה או לביטול שיוך) ברגע שהשליחות שלה יצאה לדרך
(`IN_TRANSIT` ומעלה) - `LOCKED_PACKAGE_STATUSES`.

**משימת אריזה (`PackingTaskStatus`):** `ASSIGNED → IN_PROGRESS → COMPLETED`, עם אפשרות
ביטול (`CANCELLED`) משני המצבים הראשונים.

**שליחות (`MissionStatus`):**
`DRAFT → PLANNED → LOADING → IN_TRANSIT → UNLOADING → COMPLETED`, עם ביטול אפשרי
מ-`DRAFT`/`PLANNED`. השליחות ניתנת לעריכה (מסלול, עצירות, אריזות) רק ב-`DRAFT`/`PLANNED`
(`isMissionEditable`); שחרור אריזות עדיין אפשרי גם ב-`LOADING` (`isMissionBeforeDeparture`).

**בקשת הצטרפות לשליחות (`JoinRequestStatus`):** `PENDING → APPROVED | REJECTED` (סופי).

## 3. Frontend (`apps/web`)

- **ניתוב לפי תפקיד** - `apps/web/src/components/layout/navigation.ts` מגדיר לכל פריט
  ניווט את רשימת התפקידים שרשאים לראות אותו; `AppShell` מסנן לפי המשתמש המחובר.
  זה נוחות תצוגה בלבד - ההרשאה האמיתית תמיד נאכפת בשרת (ראו 2.3).
- **State/Data fetching** - TanStack Query בלבד (`apps/web/src/api/queries.ts`); אין
  Redux/Context גלובלי לנתוני שרת. `AuthContext` מחזיק רק את מצב ההתחברות.
- **אימות קלט** - Zod, מאותן סכמות ב-`@south/shared` ששרת ה-API בודק, כדי שהודעת השגיאה
  שהמשתמש רואה בטופס תהיה זהה למה שהשרת היה מחזיר.
- **עיצוב** - כל הצבעים, הרדיוסים והצללים מוגדרים פעם אחת ב-`theme/tokens.ts`. פירוט
  מלא ב-[`docs/design/design-language.md`](design/design-language.md).
- **מפת חדרים** - SVG מבוסס נתונים (לא תמונה/מפה גאוגרפית), נבנה מתוך מבנה קומות/חדרים
  שמגיע מה-API; לחיצה על חדר טוענת את הציוד האמיתי המשויך אליו מה-DB.

## 4. זרימות מרכזיות

### 4.1 ממיפוי חדרים למשימת אריזה

1. מיפוי חדרים (אילו פריטי קטלוג נמצאים באיזה חדר, בכמות מה) נטען ל-`RoomInventory`
   דרך ה-Importer (`apps/api/src/modules/inventory/mapping-importer.ts`, CLI:
   `npm run import:mapping`) או דרך ה-Seed.
2. מפקד יוצר משימת אריזה (`PackingTasksModule`) ובוחר ציוד: פריט ספציפי לפי `assetTag`
   (מחשב/מסך מזוהה) או כמות מפריט קטלוגי כללי. הבחירה הכמותית משריינת מלאי מיידית
   (`InventoryService.reserveBulk`, סעיף 2.2) כך שמשימה אחרת לא יכולה לשריין את אותה
   כמות פעמיים.
3. חייל מבצע את המשימה: מסמן פריטים ספציפיים כ"נארזו" (Asset status), או מדווח כמות
   שנארזה לפריט הכמותי (עד לכמות ששוריינה).

### 4.2 אריזה, QR וסגירה

1. חייל פותח אריזה (`OPEN`), מוסיף אליה תכולה מתוך משימה משויכת.
2. סגירה (`SEALED`) מייצרת `publicToken` אקראי (32 בייט, `crypto.randomBytes` →
   base64url) שנשמר על האריזה. ה-QR שמודפס על התווית מכיל רק כתובת סריקה עם ה-Token
   הזה - **לא** מזהה רציף, לא תוכן האריזה ולא מיקום. ראו `docs/security.md`.
3. `READY_FOR_SHIPMENT` מסמן שהאריזה עברה בדיקת תקינות ומוכנה להצטרף לשליחות.

### 4.3 שליחות, מסלול ונסיעה מאובטחת

1. מפקד מרכיב שליחות עם מספר בסיסי איסוף (עצירות) ומשייך אליה אריזות שמוכנות לשילוח
   מאותם בסיסים (`isPackageAssignable`).
2. `RoutingModule` מציע סדר עצירות ומסביר את הבחירה (לא אופטימיזציה "קופסה שחורה" -
   ההסבר חייב להיות משהו שאפשר להציג למפקד).
3. ניתן לסמן שהשליחות דורשת "נסיעה מאובטחת" (`securedTransportNotes`) - שדה שמוצג רק
   למשתמשים מורשים (מפקד, ולא לכל חייל שרואה את השליחות).
4. חייל יכול לבקש להצטרף עם איסוף נוסף לשליחות שכבר מתוכננת (`JoinRequestStatus`);
   מפקד מאשר/דוחה.

### 4.4 יציאה, קליטה ופיזור

1. העמסה (`LOADING`) ואז יציאה לדרך (`IN_TRANSIT`) - פעולת היציאה היא Idempotent
   (קריאה כפולה לא יוצרת תזוזה כפולה), ואריזות באותה שליחות ננעלות (2.5).
2. עריכת אריזה אחרי יציאה נדחית ב-409 (State Machine, לא בדיקת UI).
3. בקריית התקשוב, חייל סורק את ה-QR (`GET /packages/scan/:publicToken`, דורש התחברות
   והרשאה - סריקה ללא התחברות מקבלת 401). הסריקה מעדכנת את האריזה ל-`RECEIVED_AT_HUB`.
4. פיזור (`DELIVERED_TO_ROOM`) מעדכן את מלאי חדר היעד באותו מנגנון עדכון אטומי (2.2),
   ומוסיף אירוע לציר הזמן של האריזה.

### 4.5 תמונת מצב (Dashboard, מפה, Audit)

- **Dashboard** (`DashboardModule`) מחשב את כל המדדים מהמסד בזמן קריאה (לא Snapshot
  מטמון) ומסונן לפי תפקיד - מפקד רואה את כל המבצע, ראש צוות רואה רק את הצוות שלו.
- **מפת חדרים** טוענת עבור כל חדר את הציוד המשויך אליו בפועל (`RoomInventory` +
  `Asset`), לא נתון מדומה קבוע-מראש.
- **Audit Log** (`AuditModule`) מתעד פעולות משמעותיות (יצירת משימה, סגירת אריזה, שינוי
  שיוך שליחות, אישור/דחיית בקשת הצטרפות וכו') עם מזהה המשתמש והזמן, וזמין רק למפקד.

## 5. תרשים תלות בין המודולים (ברמה גבוהה)

```text
                     ┌───────────────┐
                     │  AuthModule   │  (JWT + Refresh Cookie)
                     └───────┬───────┘
                             │ AuthGuard + RolesGuard
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                     ▼
┌───────────────┐   ┌────────────────┐   ┌──────────────────┐
│ PackingTasks   │──▶│  Inventory     │◀──│  Packages         │
│ Module         │   │  (שריון/עדכון) │   │  (QR, תכולה, ציר   │
└───────┬────────┘   └────────────────┘   │  זמן, סטטוס)      │
        │                                  └────────┬──────────┘
        │  משימה משויכת לאריזה                       │ שיוך לשליחות
        ▼                                            ▼
┌───────────────┐                          ┌──────────────────┐
│ Organization   │◀────────────────────────│  MissionsModule   │
│ (בסיסים/חדרים) │      עצירות לפי בסיס     │  + RoutingModule  │
└───────┬────────┘                          └──────────────────┘
        │
        ▼
┌───────────────┐        ┌───────────────┐
│ DashboardModule│        │  AuditModule  │
│ (קריאה בלבד)   │        │ (רישום פעולות)│
└───────────────┘        └───────────────┘
```

כל החצים "קריאה בלבד" (Dashboard, Audit) לא כותבים ל-State - הם צורכים את אותו מסד
דרך Prisma כמו שאר המודולים, בלי שכבת קאש/Snapshot נפרדת שיכולה להתיישן.

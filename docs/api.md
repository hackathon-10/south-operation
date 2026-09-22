# API

התיעוד המלא והאינטראקטיבי (כולל סכמות בקשה/תגובה, קודי שגיאה ואפשרות "Try it out" עם
Bearer Token) נמצא ב-**Swagger**: `http://localhost:3000/api/docs` בהרצה מקומית מול
Supabase (`npm run dev`), או `<כתובת-ה-API-ב-Vercel>/api/docs` בפרודקשן. מסמך זה הוא
סקירה קצרה כדי להתמצא לפני שנכנסים ל-Swagger - הוא לא מחליף אותו.

כל נקודות הקצה תחת קידומת `/api/v1`. כל הבקשות (חוץ מ-`/auth/login`, `/auth/refresh`,
`/auth/demo-users` ו-`/health`) דורשות `Authorization: Bearer <access-token>` שמתקבל
מ-`/auth/login`. הרשאה ברמת תפקיד ואובייקט נאכפת בשרת בכל נקודת קצה - ראו
[`docs/security.md`](security.md) ו-[`docs/architecture.md`](architecture.md#23-הרשאות-ברמת-אובייקט).

## Auth

| Method | Path | תיאור |
| --- | --- | --- |
| POST | `/auth/login` | התחברות עם אימייל+סיסמה. מחזיר Access Token, קובע Refresh Cookie. |
| POST | `/auth/refresh` | מרענן Access Token מתוך ה-Refresh Cookie. |
| POST | `/auth/logout` | מבטל את ה-Refresh Cookie. |
| GET | `/auth/me` | פרטי המשתמש המחובר. |
| GET | `/auth/demo-users` | רשימת משתמשי דמו לבחירה - זמין רק כש-`ENABLE_DEMO_LOGIN=true`. |

## Reference Data (בסיסים, יחידות, צוותים, חדרים, מפות)

| Method | Path | תיאור |
| --- | --- | --- |
| GET | `/bases`, `/units`, `/teams` | נתוני ארגון בסיסיים, לפי הרשאת המשתמש. |
| GET | `/rooms`, `/rooms/:id` | רשימת חדרים / חדר בודד. |
| GET | `/rooms/:id/inventory` | מלאי החדר (כמויות ופריטים ממופים). |
| GET | `/rooms/:id/panel` | תוכן פאנל החדר במפה - כולל הציוד האמיתי המשויך אליו. |
| GET | `/floor-maps`, `/floor-maps/:id` | מפת קומה (SVG מבוסס נתונים) ורשימת קומות. |
| GET | `/floor-maps/search` | חיפוש חדר/ציוד על פני כל המפות. |
| GET | `/floor-maps/:id/rooms` | חדרי קומה ספציפית. |

## Catalog

| Method | Path | תיאור |
| --- | --- | --- |
| GET | `/catalog/items` | קטלוג פריטים (מק"ט, יחידה, קטגוריה). |
| GET | `/assets` | מחשבים/מסכים מזוהים לפי `assetTag` ובעלים. |

## Packing Tasks (משימות אריזה)

| Method | Path | תיאור |
| --- | --- | --- |
| GET | `/packing-tasks` | רשימת משימות, מסוננת לפי תפקיד. |
| GET | `/packing-tasks/:id` | פרטי משימה. |
| POST | `/packing-tasks` | יצירת משימה (מפקד) - כולל שריון מלאי לפריטים כמותיים. |
| PATCH | `/packing-tasks/:id` | עדכון משימה. |
| POST | `/packing-tasks/:id/start` | תחילת ביצוע. |
| POST | `/packing-tasks/:id/cancel` | ביטול - משחרר שריון מלאי שלא נוצל. |
| POST | `/packing-tasks/:taskId/packages` | פתיחת אריזה חדשה המשויכת למשימה. |

## Packages (אריזות)

| Method | Path | תיאור |
| --- | --- | --- |
| GET | `/packages`, `/packages/:id` | רשימה / פרטי אריזה (כולל ציר זמן). |
| GET | `/packages/:id/label` | נתוני תווית ה-QR (כולל ה-`publicToken`) - **נקודת הקצה היחידה** שחושפת אותו. |
| GET | `/scan/packages/:publicToken` | סריקת QR - דורש התחברות + הרשאה, מוגבל בקצב. |
| PATCH | `/packages/:id` | עדכון פרטי אריזה (רק כשפתוחה). |
| POST/DELETE | `/packages/:id/assets/:assetId` | הוספה/הסרה של פריט ספציפי (מחשב/מסך) לאריזה. |
| POST/PATCH/DELETE | `/packages/:id/bulk-lines[/:lineId]` | ניהול שורות כמות בתוך האריזה. |
| POST | `/packages/:id/seal` | סגירה - מייצר `publicToken` ומעביר ל-`SEALED`. |
| POST | `/packages/:id/reopen` | פתיחה מחדש (רק כל עוד לא ננעלה - ראו State Machine). |
| POST | `/packages/:id/receive` | קליטה בקריית התקשוב (אחרי סריקה). |
| POST | `/packages/:id/deliver` | פיזור לחדר היעד - מעדכן מלאי חדר היעד. |

## Transport Missions (שליחויות)

| Method | Path | תיאור |
| --- | --- | --- |
| GET | `/missions`, `/missions/:id` | רשימה / פרטי שליחות. |
| POST | `/missions/route-suggestions` | הצעת מסלול מוסברת לפי בסיסי איסוף שנבחרו. |
| POST | `/missions` | יצירת שליחות (מפקד) - כולל דגל "נסיעה מאובטחת". |
| PATCH | `/missions/:id` | עדכון פרטי שליחות (רק לפני יציאה). |
| POST/DELETE | `/missions/:id/packages[/:packageId]` | שיוך/ביטול שיוך אריזה לשליחות. |
| PATCH | `/missions/:id/stops/reorder` | שינוי סדר עצירות. |
| POST | `/missions/:id/cancel` | ביטול שליחות. |
| POST | `/missions/:id/start-loading` | תחילת העמסה. |
| POST | `/missions/:id/stops/:stopId/arrive` | סימון הגעה לעצירה. |
| POST | `/missions/:id/packages/:packageId/load` | העמסת אריזה (Idempotent). |
| POST | `/missions/:id/depart` | יציאה לדרך - נועל את האריזות המשויכות. |
| POST | `/missions/:id/start-unloading`, `/complete` | תחילת פריקה / סיום שליחות. |
| POST | `/missions/:id/packages/:packageId/unload` | פריקת אריזה בקליטה. |
| POST | `/missions/:id/join-requests` | בקשת חייל להצטרף עם איסוף נוסף. |

## Mission Join Requests (בקשות הצטרפות)

| Method | Path | תיאור |
| --- | --- | --- |
| GET | `/mission-join-requests` | רשימת בקשות ממתינות (מפקד). |
| POST | `/mission-join-requests/:id/approve` | אישור בקשה. |
| POST | `/mission-join-requests/:id/reject` | דחיית בקשה. |

## Dashboard

| Method | Path | תיאור |
| --- | --- | --- |
| GET | `/dashboard/commander` | תמונת מצב מלאה של המבצע (מפקד בלבד). |
| GET | `/dashboard/soldier` | משימות/אריזות/שליחויות רלוונטיות לחייל המחובר. |
| GET | `/dashboard/team-lead` | תמונת מצב מצומצמת לצוות של ראש הצוות. |

## Users, Audit, Health

| Method | Path | תיאור |
| --- | --- | --- |
| GET | `/users` | רשימת משתמשים (למסכי שיוך/בחירה). |
| GET | `/audit-logs` | יומן פעולות (מפקד בלבד). |
| GET | `/health` | בדיקת חיות - `{status, database, uptimeSeconds, version}`, ללא אימות. |

## קודי שגיאה

תשובת שגיאה היא תמיד `{ "code": "...", "message": "...", "hint"?: "...", "traceId": "..." }`
- **אף פעם לא** קוד HTTP גולמי או Stack Trace. קטלוג הקודים המלא (וההודעה בעברית לכל
אחד מהם) נמצא ב-`packages/shared/src/errors.ts` והוא אותו קטלוג שהממשק משתמש בו כדי
להציג הודעות אנושיות.

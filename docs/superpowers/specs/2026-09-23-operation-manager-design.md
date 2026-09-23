# מפקד מבצע (OPERATION_MANAGER) - מסמך עיצוב

תאריך: 2026-09-23

## 1. המטרה

הוספת תפקיד רביעי למערכת: **מפקד מבצע**. בניגוד למפקד הלוגיסטיקה, שעובד ברזולוציה של
משימה, אריזה ושליחות בודדת, מפקד המבצע מסתכל על התמונה הרחבה בלבד - מצב כל הבסיסים וכל
היחידות הארגוניות בכל רגע נתון.

עיקרון מנחה לעיצוב המסך: **דק כמו של מנהל**. לא מטריצה של שבעה סטטוסים על פני שמונה-עשרה
שורות, אלא פסיקה - האם המבצע בזמנים, איפה תקוע, ומה מחכה להחלטה שלו.

## 2. מה נקבע

| שאלה | החלטה |
|---|---|
| מהי "יחידה" | `Base` ו-`OrganizationalUnit` בלבד. לא `Team`. |
| הרשאות | קריאה בלבד על כל המבצע, **בתוספת** אישור בקשות הצטרפות לשליחות. |
| ציר הזמן | מצב עכשווי חי (Polling). אין שחזור היסטורי ואין Push. |
| תוכן המסך | אחוז התקדמות + חיווי בריאות (ירוק/כתום/אדום) + פאנל החלטות. |

## 3. הסיכון המרכזי: נפילה דרך ברירת המחדל

`UserRole` הוא Enum שתלויים בו כ-22 קבצים. שתי נקודות בקוד מטפלות בתפקידים בשיטת
"אם לא זה ואם לא זה - ברירת מחדל", וכל תפקיד חדש נופל דרכן בשקט:

1. [`apps/api/src/common/authz/access-control.ts`](../../../apps/api/src/common/authz/access-control.ts) -
   כל פונקציית הרשאה מסתיימת ב-`return false`. תפקיד חדש שלא טופל במפורש מקבל **אפס גישה**,
   בלי שגיאה ובלי אזהרת קומפילציה.
2. [`apps/web/src/features/dashboard/HomePage.tsx`](../../../apps/web/src/features/dashboard/HomePage.tsx) -
   ה-`switch` מסתיים ב-`default: return <TeamLeadOverview />`. תפקיד חדש מקבל בשקט את
   המסך של ראש צוות.

שתי הנפילות האלה מטופלות במפורש כחלק מהשינוי. זו לא הרחבת סקופ - זו בדיוק התקלה שהשינוי
הזה היה נכנס אליה.

היחיד שכן יתריע בזמן קומפילציה הוא `USER_ROLE_LABEL: Record<UserRole, string>`
ב-[`packages/shared/src/labels.ts`](../../../packages/shared/src/labels.ts), שיישבר עד
שתתווסף התווית. זו רשת הביטחון היחידה הקיימת היום.

## 4. שכבת ההרשאות

מתווספת הפונקציה `isOperationManager`, וכל פונקציה ב-`access-control.ts` מטפלת בתפקיד
החדש במפורש:

| פונקציה | מפקד מבצע | נימוק |
|---|---|---|
| `canViewPackage` | ✅ | רואה הכול. |
| `canViewTask` | ✅ | רואה הכול. |
| `canViewMission` | ✅ | רואה הכול. |
| `canViewSecuredTransportNotes` | ✅ | הוא המפקד הבכיר במבצע. |
| `canEditPackageContent` | ❌ | לא נוגע בתכולה. |
| `canExecuteTask` | ❌ | לא מבצע בשטח. |
| `canExecuteMission` | ❌ | לא מבצע בשטח. |
| `canHandleAtHub` | ❌ | לא קולט ולא מפזר. |
| אישור בקשת הצטרפות | ✅ | ההחלטה היחידה שהוא מקבל במערכת. |

**NoCyberHere: AUTHORIZATION** - התפקיד החדש מרחיב הרשאות צפייה בלבד. נתיב הכתיבה היחיד
שנפתח לו הוא אישור/דחייה של בקשת הצטרפות, והוא מקבל בדיקת הרשאה ובדיקת יחידה משלו.

## 5. נקודת הקצה

`GET /api/v1/dashboard/operation`, מוגנת ב-`@Roles(UserRole.OPERATION_MANAGER)`,
לצד שלוש נקודות הדשבורד הקיימות.

מבנה התשובה:

```ts
{
  headline: {
    overallProgressPct: number;      // אריזות שהגיעו לחדר היעד מתוך סך האריזות
    packagesDelivered: number;
    packagesTotal: number;
    missionsInTransit: number;
    basesAtRisk: number;             // כמה בסיסים בחיווי אדום
  },
  bases: Array<{
    baseId: string; baseName: string;
    progressPct: number;
    health: 'GREEN' | 'AMBER' | 'RED';
    reasons: string[];               // מה הוביל לחיווי, בעברית
    units: Array<{
      unitId: string; unitName: string;
      progressPct: number;
      health: 'GREEN' | 'AMBER' | 'RED';
      reasons: string[];
    }>;
  }>,
  pendingDecisions: {                // בקשות הצטרפות שממתינות לו
    joinRequests: JoinRequestSummary[];
  }
}
```

חיווי הבסיס הוא החמור מבין חיווי היחידות שתחתיו, כדי שכרטיס מקופל לא יסתיר יחידה אדומה.

## 6. כללי החיווי

הכללים יושבים בקובץ טהור וניתן לבדיקה ביחידה, `operation-health.ts`, בנפרד משאילתות
ה-Prisma - באותה רוח שבה `access-control.ts` הופרד מהשירותים.

| חיווי | תנאי |
|---|---|
| 🔴 אדום | קיימת משימת `URGENT` שעדיין ב-`ASSIGNED` (אף אחד לא התחיל), **או** אריזה ב-`READY_FOR_SHIPMENT` מעל `RED_READY_HOURS` בלי שליחות משויכת. |
| 🟠 כתום | קיימת משימת `HIGH` שעדיין ב-`ASSIGNED`, **או** אריזה ב-`READY_FOR_SHIPMENT` מעל `AMBER_READY_HOURS`. |
| 🟢 ירוק | אחרת. |

ערכי הסף: `RED_READY_HOURS = 24`, `AMBER_READY_HOURS = 12`. שניהם קבועים בעלי שם בקובץ
אחד, לא מספרי קסם פזורים, כדי שיהיו ניתנים לכוונון בנקודה אחת.

משך ההמתנה מחושב מ-`PackageStatusEvent`, שמאונדקס `[packageId, createdAt]` - כלומר
"כמה זמן האריזה יושבת בסטטוס הזה" הוא שאילתה זולה.

## 7. צד הלקוח

- מסך חדש `OperationDashboard`, שלוש רצועות: כותרת עם המספר הראשי, כרטיס לכל בסיס
  שנפתח ליחידות שלו, ופאנל "ממתין להחלטתך".
- `HomePage` מקבל `case` מפורש לתפקיד החדש, וה-`default` מפסיק להחזיר את מסך ראש הצוות
  בשקט.
- רענון: `refetchInterval` על שאילתת הדשבורד. ערך התחלתי 30 שניות.
- ניווט דק, שלושה פריטים בלבד: **דשבורד**, **בקשות הצטרפות**, **יומן פעולות**. אל
  האריזות והשליחויות הוא מגיע בקדיחה משורה אדומה, לא מפריט קבוע בסרגל. אין **סריקת QR** -
  זו עבודת שטח.

## 8. הקבצים שנוגעים בהם

**מסד ושכבה משותפת**
- `apps/api/prisma/schema.prisma` - ערך ל-`UserRole`
- `apps/api/prisma/migrations/<timestamp>_add_operation_manager_role/` - מיגרציה חדשה
- `packages/shared/src/enums.ts`, `packages/shared/src/labels.ts` - הערך והתווית `מפקד מבצע`

**API**
- `apps/api/src/common/authz/access-control.ts` + `access-control.spec.ts`
- `apps/api/src/modules/dashboard/operation-health.ts` (חדש) + בדיקות יחידה
- `apps/api/src/modules/dashboard/dashboard.service.ts`, `dashboard.controller.ts`
- `apps/api/src/modules/missions/join-requests.controller.ts` - הוספת התפקיד ל-`@Roles`
- `apps/api/prisma/seed-data.ts` - משתמש הדגמה

**Web**
- `apps/web/src/features/dashboard/OperationDashboard.tsx` (חדש)
- `apps/web/src/features/dashboard/HomePage.tsx`
- `apps/web/src/components/layout/navigation.ts` + `navigation.test.ts`
- `apps/web/src/App.tsx` - הרשאות נתיבים

**תיעוד**
- `README.md` - טבלת התפקידים וחשבונות הדמו
- `docs/security.md` - שורה בטבלת ההרשאות

## 9. בדיקות

1. **`access-control.spec.ts`** - לכל אחת מתשע הפונקציות בטבלה שבסעיף 4, מקרה מפורש
   לתפקיד החדש. זו הבדיקה שמונעת את נפילת ברירת המחדל.
2. **`operation-health.spec.ts`** - כללי החיווי כפונקציה טהורה: אדום על `URGENT` שלא
   התחיל, אדום על אריזה ממתינה מעל הסף, כתום על `HIGH`, ירוק כברירת מחדל, וכן שחיווי
   הבסיס הוא החמור מבין יחידותיו.
3. **אינטגרציה** - `GET /dashboard/operation` מחזיר 200 למפקד מבצע ו-403 לשלושת
   התפקידים האחרים; מפקד מבצע מקבל 403 על נתיב כתיבה לאריזה.
4. **Web** - `navigation.test.ts` מאמת שהתפקיד מקבל בדיוק שלושה פריטים; בדיקת `HomePage`
   מאמתת שהתפקיד מקבל את המסך שלו ולא את מסך ראש הצוות.

## 10. מה במפורש לא נכלל

- שכבת הרשאות מבוססת יכולות (Capability Matrix) במקום הסתעפות לפי תפקיד. נשקלה ונדחתה:
  היא כתיבה מחדש של קובץ קריטי לאבטחה, ואין לעשות אותה באותו שינוי שמוסיף תפקיד.
- שחזור היסטורי של מצב המבצע ("Time Travel").
- עדכוני Push (SSE/WebSocket).
- רזולוציית צוות בדשבורד.

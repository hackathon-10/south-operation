/**
 * קטלוג שגיאות המערכת.
 *
 * קוד ה-HTTP משמש את ה-API ואת הלוגים בלבד (§11 באפיון).
 * המשתמש רואה תמיד הודעה אנושית בעברית ופעולה אפשרית, לעולם לא "403" או "404".
 */

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown | null;
  traceId?: string;
}

export interface ErrorDefinition {
  status: number;
  /** הודעה אנושית בעברית שמוצגת למשתמש. */
  message: string;
  /** הפעולה שהמשתמש יכול לבצע כדי להתקדם. */
  hint?: string;
}

export const ERROR_CATALOG = {
  // --- אימות והרשאות ---
  INVALID_CREDENTIALS: {
    status: 401,
    message: 'שם המשתמש או הסיסמה אינם נכונים',
    hint: 'בדקו את הפרטים ונסו שוב',
  },
  NOT_AUTHENTICATED: {
    status: 401,
    message: 'צריך להתחבר כדי להמשיך',
    hint: 'מעבר למסך ההתחברות',
  },
  SESSION_EXPIRED: {
    status: 401,
    message: 'החיבור פג. יש להתחבר מחדש',
    hint: 'מעבר למסך ההתחברות',
  },
  INVALID_REFRESH_TOKEN: {
    status: 401,
    message: 'החיבור פג. יש להתחבר מחדש',
    hint: 'מעבר למסך ההתחברות',
  },
  ACCOUNT_DISABLED: {
    status: 403,
    message: 'המשתמש אינו פעיל במערכת',
    hint: 'פנו למפקד הלוגיסטיקה',
  },
  FORBIDDEN_ROLE: {
    status: 403,
    message: 'התפקיד שלך אינו מורשה לבצע את הפעולה הזו',
    hint: 'חזרה למסך הקודם',
  },
  FORBIDDEN_PACKAGE_SCOPE: {
    status: 403,
    message: 'אין לך הרשאה לצפות באריזה הזו',
    hint: 'חזרה לרשימת האריזות',
  },
  FORBIDDEN_TASK_SCOPE: {
    status: 403,
    message: 'המשימה הזו אינה משויכת אליך',
    hint: 'חזרה לרשימת המשימות שלי',
  },
  FORBIDDEN_MISSION_SCOPE: {
    status: 403,
    message: 'אין לך הרשאה לשליחות הזו',
    hint: 'חזרה לרשימת השליחויות',
  },
  FORBIDDEN_BASE_SCOPE: {
    status: 403,
    message: 'אין לך הרשאה למידע של הבסיס הזה',
    hint: 'חזרה לדף הבית',
  },
  DEMO_LOGIN_DISABLED: {
    status: 403,
    message: 'כניסת דמו אינה זמינה בסביבה הזו',
    hint: 'התחברו עם שם משתמש וסיסמה',
  },
  RATE_LIMITED: {
    status: 429,
    message: 'יותר מדי ניסיונות. נסו שוב בעוד רגע',
    hint: 'המתינו כדקה ונסו שוב',
  },

  // --- לא נמצא ---
  RESOURCE_NOT_FOUND: {
    status: 404,
    message: 'הפריט שחיפשת לא נמצא',
    hint: 'חזרה למסך הקודם',
  },
  ROOM_NOT_FOUND: { status: 404, message: 'החדר שחיפשת לא נמצא', hint: 'חזרה למפת החדרים' },
  BASE_NOT_FOUND: { status: 404, message: 'הבסיס שחיפשת לא נמצא', hint: 'חזרה לדף הבית' },
  TEAM_NOT_FOUND: { status: 404, message: 'הצוות שחיפשת לא נמצא', hint: 'חזרה לדף הבית' },
  USER_NOT_FOUND: { status: 404, message: 'המשתמש שחיפשת לא נמצא', hint: 'חזרה לדף הבית' },
  FLOOR_MAP_NOT_FOUND: { status: 404, message: 'מפת הקומה לא נמצאה', hint: 'חזרה למפת החדרים' },
  CATALOG_ITEM_NOT_FOUND: { status: 404, message: 'המוצר שחיפשת לא נמצא', hint: 'חזרה למסך הקודם' },
  ASSET_NOT_FOUND: {
    status: 404,
    message: 'לא נמצא מחשב או מסך עם המזהה הזה',
    hint: 'בדקו את המזהה על המדבקה ונסו שוב',
  },
  TASK_NOT_FOUND: { status: 404, message: 'משימת האריזה לא נמצאה', hint: 'חזרה לרשימת המשימות' },
  PACKAGE_NOT_FOUND: { status: 404, message: 'האריזה לא נמצאה', hint: 'חזרה לרשימת האריזות' },
  PACKAGE_TOKEN_NOT_FOUND: {
    status: 404,
    message: 'לא זיהינו את האריזה מהסריקה',
    hint: 'נסו לסרוק שוב או הזינו את מספר האריזה ידנית',
  },
  MISSION_NOT_FOUND: { status: 404, message: 'השליחות לא נמצאה', hint: 'חזרה לרשימת השליחויות' },
  STOP_NOT_FOUND: { status: 404, message: 'העצירה לא נמצאה', hint: 'חזרה לפרטי השליחות' },
  JOIN_REQUEST_NOT_FOUND: {
    status: 404,
    message: 'בקשת ההצטרפות לא נמצאה',
    hint: 'חזרה לרשימת הבקשות',
  },
  PACKAGE_LINE_NOT_FOUND: {
    status: 404,
    message: 'שורת התכולה לא נמצאה באריזה',
    hint: 'רעננו את המסך ונסו שוב',
  },

  // --- קלט לא תקין ---
  VALIDATION_FAILED: {
    status: 400,
    message: 'חלק מהפרטים שהוזנו אינם תקינים',
    hint: 'בדקו את השדות המסומנים ונסו שוב',
  },
  SERIALIZED_REQUIRES_ASSET: {
    status: 422,
    message: 'עבור מחשב או מסך יש לבחור פריט מסוים לפי מזהה',
    hint: 'בחרו פריט מהרשימה',
  },
  BULK_FORBIDS_ASSET: {
    status: 422,
    message: 'ציוד כמותי נבחר לפי מק״ט וכמות, ולא לפי מזהה פריט',
    hint: 'הזינו כמות במקום מזהה',
  },
  QUANTITY_MUST_BE_POSITIVE: {
    status: 422,
    message: 'הכמות חייבת להיות גדולה מאפס',
    hint: 'עדכנו את הכמות',
  },
  SECURED_TRANSPORT_NOTES_REQUIRED: {
    status: 422,
    message: 'כאשר נדרשת נסיעה מאובטחת יש להזין הנחיות',
    hint: 'מלאו את שדה ההנחיות',
  },
  MISSION_REQUIRES_PACKAGES: {
    status: 422,
    message: 'אי אפשר לתכנן שליחות בלי אריזות',
    hint: 'בחרו לפחות אריזה אחת',
  },
  MISSION_REQUIRES_SOLDIER: {
    status: 422,
    message: 'יש לשייך חייל מבצע לשליחות',
    hint: 'בחרו חייל מהרשימה',
  },
  EMPTY_PACKAGE: {
    status: 422,
    message: 'אי אפשר לסגור אריזה ריקה',
    hint: 'הוסיפו לפחות פריט אחד לאריזה',
  },
  INVALID_STOP_ORDER: {
    status: 422,
    message: 'סדר העצירות אינו תקין',
    hint: 'ודאו שכל העצירות מופיעות פעם אחת',
  },

  // --- התנגשות מצב ---
  PACKAGE_LOCKED: {
    status: 409,
    message: 'לא ניתן לערוך אריזה לאחר שהשליחות יצאה לדרך',
    hint: 'חזרה לפרטי האריזה',
  },
  PACKAGE_INVALID_STATUS: {
    status: 409,
    message: 'הפעולה אינה אפשרית במצב הנוכחי של האריזה',
    hint: 'רעננו את המסך ובדקו את הסטטוס',
  },
  PACKAGE_ALREADY_IN_MISSION: {
    status: 409,
    message: 'האריזה כבר משויכת לשליחות אחרת',
    hint: 'בחרו אריזה אחרת',
  },
  PACKAGE_NOT_IN_MISSION: {
    status: 409,
    message: 'האריזה אינה משויכת לשליחות הזו',
    hint: 'בדקו את רשימת האריזות של השליחות',
  },
  PACKAGE_NOT_IN_CURRENT_STOP: {
    status: 409,
    message: 'האריזה שייכת לעצירה אחרת במסלול',
    hint: 'המשיכו לעצירה הנכונה',
  },
  PACKAGE_ALREADY_LOADED: {
    status: 409,
    message: 'האריזה כבר סומנה כהועמסה',
    hint: 'אפשר להמשיך לאריזה הבאה',
  },
  PACKAGE_ALREADY_RECEIVED: {
    status: 409,
    message: 'האריזה כבר נקלטה',
    hint: 'אפשר להמשיך לאריזה הבאה',
  },
  PACKAGE_ALREADY_DELIVERED: {
    status: 409,
    message: 'האריזה כבר סומנה כהגיעה לחדר',
    hint: 'אפשר להמשיך לאריזה הבאה',
  },
  PACKAGE_NOT_RECEIVED: {
    status: 409,
    message: 'צריך לקלוט את האריזה בקריית התקשוב לפני הפיזור',
    hint: 'בצעו קליטה ואז פיזור',
  },
  ASSET_ALREADY_PACKED: {
    status: 409,
    message: 'הפריט הזה כבר נארז באריזה אחרת',
    hint: 'בחרו פריט אחר',
  },
  ASSET_NOT_IN_TASK: {
    status: 409,
    message: 'הפריט הזה אינו חלק ממשימת האריזה',
    hint: 'בחרו מתוך רשימת המשימה',
  },
  ASSET_WRONG_ROOM: {
    status: 409,
    message: 'הפריט אינו נמצא בחדר המקור של המשימה',
    hint: 'בדקו את המזהה על המדבקה',
  },
  ASSET_NOT_AVAILABLE: {
    status: 409,
    message: 'הפריט אינו זמין לשיוך למשימה',
    hint: 'בחרו פריט אחר',
  },
  PRODUCT_NOT_IN_TASK: {
    status: 409,
    message: 'המוצר הזה אינו חלק ממשימת האריזה',
    hint: 'בחרו מתוך רשימת המשימה',
  },
  QUANTITY_EXCEEDS_TASK: {
    status: 409,
    message: 'הכמות גדולה ממה שנותר לארוז במשימה',
    hint: 'הקטינו את הכמות',
  },
  INSUFFICIENT_INVENTORY: {
    status: 409,
    message: 'אין מספיק מלאי זמין בחדר המקור',
    hint: 'הקטינו את הכמות או בחרו חדר אחר',
  },
  TASK_INVALID_STATUS: {
    status: 409,
    message: 'הפעולה אינה אפשרית במצב הנוכחי של המשימה',
    hint: 'רעננו את המסך ובדקו את הסטטוס',
  },
  TASK_NOT_FULLY_PACKED: {
    status: 409,
    message: 'עדיין נשארו פריטים לארוז במשימה',
    hint: 'השלימו את האריזה ונסו שוב',
  },
  TASK_HAS_ACTIVE_PACKAGES: {
    status: 409,
    message: 'יש אריזות פעילות במשימה. צריך לרוקן או לבטל אותן לפני ביטול המשימה',
    hint: 'פתחו את האריזות ורוקנו אותן',
  },
  MISSION_INVALID_STATUS: {
    status: 409,
    message: 'הפעולה אינה אפשרית במצב הנוכחי של השליחות',
    hint: 'רעננו את המסך ובדקו את הסטטוס',
  },
  MISSION_LOCKED: {
    status: 409,
    message: 'לא ניתן לשנות שליחות לאחר שיצאה לדרך',
    hint: 'חזרה לפרטי השליחות',
  },
  MISSION_NOT_ALL_LOADED: {
    status: 409,
    message: 'צריך להעמיס את כל האריזות המתוכננות לפני היציאה',
    hint: 'השלימו את ההעמסה בכל העצירות',
  },
  MISSION_NOT_ALL_UNLOADED: {
    status: 409,
    message: 'צריך לקלוט את כל האריזות לפני סגירת השליחות',
    hint: 'השלימו את הקליטה',
  },
  STOP_NOT_ARRIVED: {
    status: 409,
    message: 'צריך לסמן הגעה לעצירה לפני ההעמסה',
    hint: 'סמנו הגעה לעצירה',
  },
  JOIN_REQUEST_INVALID_STATUS: {
    status: 409,
    message: 'הבקשה כבר טופלה',
    hint: 'חזרה לרשימת הבקשות',
  },
  DUPLICATE_BUSINESS_KEY: {
    status: 409,
    message: 'כבר קיים רישום עם אותם פרטים',
    hint: 'בדקו את הנתונים ונסו שוב',
  },

  // --- כללי ---
  INTERNAL_ERROR: {
    status: 500,
    message: 'משהו השתבש אצלנו. נסו שוב בעוד רגע',
    hint: 'אם הבעיה חוזרת, פנו למפקד הלוגיסטיקה',
  },
  DATABASE_UNAVAILABLE: {
    status: 503,
    message: 'אין כרגע חיבור למסד הנתונים',
    hint: 'נסו שוב בעוד רגע',
  },
} as const satisfies Record<string, ErrorDefinition>;

export type AppErrorCode = keyof typeof ERROR_CATALOG;

export function errorDefinition(code: AppErrorCode): ErrorDefinition {
  return ERROR_CATALOG[code];
}

/**
 * מתרגם תשובת שגיאה של ה-API להודעה אנושית.
 * אם הקוד אינו מוכר, נופלים להודעה כללית - ולעולם לא מציגים מספר סטטוס למשתמש.
 */
export function humanizeApiError(
  body?: Partial<ApiErrorBody> | null,
  fallback: AppErrorCode = 'INTERNAL_ERROR',
): ErrorDefinition {
  const code = body?.code as AppErrorCode | undefined;
  if (code && code in ERROR_CATALOG) {
    const def = ERROR_CATALOG[code];
    return body?.message ? { ...def, message: body.message } : def;
  }
  return ERROR_CATALOG[fallback];
}

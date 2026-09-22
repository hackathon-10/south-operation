/** קבועים עסקיים המשותפים ל-API ול-Web. */

/** Prefix למזהים ידידותיים למשתמש (§6 באפיון). */
export const ID_PREFIX = {
  PACKAGE: 'PKG-',
  TASK: 'TSK-',
  MISSION: 'SHP-',
} as const;

/** אורך המספר הרץ בתוך המזהה הידידותי. */
export const FRIENDLY_ID_DIGITS = 5;

/** קוד הבסיס של קריית התקשוב - יעד כל השליחויות. */
export const HUB_BASE_CODE = 'KT';

/** שם בניין היעד במפה האינטראקטיבית. */
export const HUB_BUILDING_NAME = 'בניין תקשוב מרכזי';

/** מספר הקומות במפת בניין היעד. */
export const HUB_FLOORS = [1, 2, 3, 4, 5] as const;

/** ברירות מחדל של קנבס המפה (יחידות לוגיות, מומרות ל-SVG רספונסיבי). */
export const FLOOR_MAP_CANVAS = {
  width: 1000,
  height: 600,
} as const;

/** תבנית הפריסה של כל קומה: מסדרון מרכזי, ארבעה חדרים בצפון וארבעה בדרום. */
export const FLOOR_MAP_LAYOUT = {
  corridor: { x: 20, y: 250, width: 960, height: 100 },
  room: { width: 200, height: 170 },
  northY: 40,
  southY: 390,
  columnsX: [40, 280, 520, 760],
} as const;

/** ברירות מחדל ל-Pagination. */
export const PAGINATION = {
  defaultPage: 1,
  defaultPageSize: 25,
  maxPageSize: 100,
} as const;

/** מהירות נסיעה ממוצעת להערכת זמן במסלול (קמ"ש). הערכה בלבד. */
export const AVERAGE_SPEED_KMH = 55;

/** דקות שירות קבועות לכל עצירת איסוף, להערכת משך השליחות. */
export const STOP_SERVICE_MINUTES = 20;

/** רדיוס כדור הארץ בקילומטרים לחישוב Haversine. */
export const EARTH_RADIUS_KM = 6371;

/** אורך ה-Token האקראי שמוטמע ב-QR (בבתים לפני קידוד). */
export const PACKAGE_TOKEN_BYTES = 32;

/** נתיב הסריקה ב-Frontend. ה-QR מכיל רק את ה-Token האטום. */
export const SCAN_PATH = '/scan/package';

export function buildScanUrl(webBaseUrl: string, publicToken: string): string {
  const base = webBaseUrl.replace(/\/+$/, '');
  return `${base}${SCAN_PATH}/${publicToken}`;
}

/** מזהה ידידותי מרופד באפסים, לדוגמה PKG-10425. */
export function formatFriendlyId(prefix: string, sequence: number): string {
  return `${prefix}${String(sequence).padStart(FRIENDLY_ID_DIGITS, '0')}`;
}

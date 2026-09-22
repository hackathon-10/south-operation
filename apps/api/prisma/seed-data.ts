/**
 * נתוני הדמה של מערכת המעבר דרומה.
 *
 * כל השמות, המספרים האישיים, הכתובות ונקודות הציון הם סינתטיים לחלוטין
 * ואינם מייצגים מידע אמיתי כלשהו (§12 באפיון).
 */

export const BASES = [
  {
    code: 'KT',
    name: 'קריית התקשוב',
    addressText: 'אזור דמה צפון, שער ראשי',
    latitude: 31.2530,
    longitude: 34.7915,
    isDestinationHub: true,
  },
  {
    code: 'GDN',
    name: 'גדעונים',
    addressText: 'אזור דמה מרכז, כביש גישה 4',
    latitude: 32.0210,
    longitude: 34.8550,
    isDestinationHub: false,
  },
  {
    code: 'TZR',
    name: 'צריפין',
    addressText: 'אזור דמה מרכז, שער מזרחי',
    latitude: 31.9540,
    longitude: 34.8380,
    isDestinationHub: false,
  },
  {
    code: 'SHL',
    name: 'השלישות',
    addressText: 'אזור דמה שפלה, מתחם מנהלה',
    latitude: 31.8100,
    longitude: 34.7200,
    isDestinationHub: false,
  },
] as const;

export const CATALOG = [
  // פריטים ייחודיים - מחשבים ומסכים בלבד.
  { sku: 'LT-EL-14', name: 'מחשב נייד 14 אינץ׳', category: 'מחשבים', trackingMode: 'SERIALIZED', unitOfMeasure: 'יח׳' },
  { sku: 'LT-PRO-16', name: 'מחשב נייד 16 אינץ׳', category: 'מחשבים', trackingMode: 'SERIALIZED', unitOfMeasure: 'יח׳' },
  { sku: 'DT-WS-01', name: 'מחשב שולחני עמדת עבודה', category: 'מחשבים', trackingMode: 'SERIALIZED', unitOfMeasure: 'יח׳' },
  { sku: 'MN-24', name: 'מסך 24 אינץ׳', category: 'מסכים', trackingMode: 'SERIALIZED', unitOfMeasure: 'יח׳' },
  { sku: 'MN-27', name: 'מסך 27 אינץ׳', category: 'מסכים', trackingMode: 'SERIALIZED', unitOfMeasure: 'יח׳' },
  { sku: 'MN-32-CRV', name: 'מסך מעוקל 32 אינץ׳', category: 'מסכים', trackingMode: 'SERIALIZED', unitOfMeasure: 'יח׳' },

  // ציוד כמותי.
  { sku: 'ACC-MOUSE', name: 'עכבר אלחוטי', category: 'ציוד היקפי', trackingMode: 'BULK', unitOfMeasure: 'יח׳' },
  { sku: 'ACC-KEYB', name: 'מקלדת עברית', category: 'ציוד היקפי', trackingMode: 'BULK', unitOfMeasure: 'יח׳' },
  { sku: 'ACC-HDMI', name: 'כבל HDMI 2 מטר', category: 'כבלים', trackingMode: 'BULK', unitOfMeasure: 'יח׳' },
  { sku: 'ACC-DP', name: 'כבל DisplayPort', category: 'כבלים', trackingMode: 'BULK', unitOfMeasure: 'יח׳' },
  { sku: 'ACC-LAN-3', name: 'כבל רשת 3 מטר', category: 'כבלים', trackingMode: 'BULK', unitOfMeasure: 'יח׳' },
  { sku: 'ACC-DOCK', name: 'תחנת עגינה', category: 'ציוד היקפי', trackingMode: 'BULK', unitOfMeasure: 'יח׳' },
  { sku: 'ACC-HEADSET', name: 'אוזניות עם מיקרופון', category: 'ציוד היקפי', trackingMode: 'BULK', unitOfMeasure: 'יח׳' },
  { sku: 'NET-SW-24', name: 'מתג רשת 24 פורטים', category: 'תקשורת', trackingMode: 'BULK', unitOfMeasure: 'יח׳' },
  { sku: 'NET-PATCH', name: 'פאנל פאטש', category: 'תקשורת', trackingMode: 'BULK', unitOfMeasure: 'יח׳' },
  { sku: 'LAB-OSC', name: 'אוסילוסקופ מעבדה', category: 'ציוד מעבדה', trackingMode: 'BULK', unitOfMeasure: 'יח׳' },
  { sku: 'LAB-PSU', name: 'ספק כוח מעבדה', category: 'ציוד מעבדה', trackingMode: 'BULK', unitOfMeasure: 'יח׳' },
  { sku: 'LAB-TOOL', name: 'ערכת כלי מעבדה', category: 'ציוד מעבדה', trackingMode: 'BULK', unitOfMeasure: 'ערכה' },
  { sku: 'OFF-CHAIR', name: 'כיסא משרדי', category: 'ריהוט', trackingMode: 'BULK', unitOfMeasure: 'יח׳' },
  { sku: 'OFF-BOX', name: 'ארגז תיוק', category: 'ריהוט', trackingMode: 'BULK', unitOfMeasure: 'יח׳' },
] as const;

/** שמות בעלים סינתטיים למחשבים ולמסכים. */
export const OWNERS = [
  'אלה מאיר',
  'רועי לוי',
  'מאיה כהן',
  'עידן שגב',
  'דניאל מרום',
  'איתי שפירא',
  'נטע אלון',
  'יעל רחום',
  'אלעד גולן',
  'שירה ברק',
  'תומר אביב',
  'נועה קרן',
  'עומר הדר',
  'ליאור נחום',
  'רותם ברנר',
  'אורי שלו',
  'גיא פלד',
  'הילה ארז',
  'יונתן דגן',
  'מור לביא',
] as const;

/** מבנה בניין היעד: חמש קומות, שמונה חדרים בכל קומה. */
export const HUB_FLOOR_PLAN: Array<{
  floorNumber: number;
  displayName: string;
  north: Array<{ roomNumber: string; name: string }>;
  south: Array<{ roomNumber: string; name: string }>;
}> = [
  {
    floorNumber: 1,
    displayName: 'קומה 1 - קליטה ותשתיות',
    north: [
      { roomNumber: '101', name: 'קבלה לוגיסטית' },
      { roomNumber: '102', name: 'מחסן מרכזי' },
      { roomNumber: '103', name: 'מעבדת רשת' },
      { roomNumber: '104', name: 'חדר קליטה' },
    ],
    south: [
      { roomNumber: '105', name: 'תשתיות א׳' },
      { roomNumber: '106', name: 'תשתיות ב׳' },
      { roomNumber: '107', name: 'חדר קשר' },
      { roomNumber: '108', name: 'חדר ישיבות קומה 1' },
    ],
  },
  {
    floorNumber: 2,
    displayName: 'קומה 2 - פיתוח ומוצר',
    north: [
      { roomNumber: '201', name: 'צוות פיתוח א׳' },
      { roomNumber: '202', name: 'צוות פיתוח ב׳' },
      { roomNumber: '203', name: 'מעבדת סייבר' },
      { roomNumber: '204', name: 'צוות QA' },
    ],
    south: [
      { roomNumber: '205', name: 'צוות DevOps' },
      { roomNumber: '206', name: 'צוות נתונים' },
      { roomNumber: '207', name: 'צוות מוצר' },
      { roomNumber: '208', name: 'חדר ישיבות קומה 2' },
    ],
  },
  {
    floorNumber: 3,
    displayName: 'קומה 3 - שליטה ובקרה',
    north: [
      { roomNumber: '301', name: 'חמ״ל' },
      { roomNumber: '302', name: 'שליטה ובקרה' },
      { roomNumber: '303', name: 'תקשורת' },
      { roomNumber: '304', name: 'חדר NOC' },
    ],
    south: [
      { roomNumber: '305', name: 'תמיכה טכנית' },
      { roomNumber: '306', name: 'אינטגרציה' },
      { roomNumber: '307', name: 'חדר הדרכה' },
      { roomNumber: '308', name: 'מחסן קומתי' },
    ],
  },
  {
    floorNumber: 4,
    displayName: 'קומה 4 - מטה והנהלה',
    north: [
      { roomNumber: '401', name: 'הנהלה' },
      { roomNumber: '402', name: 'רמ״ד לוגיסטיקה' },
      { roomNumber: '403', name: 'תכנון' },
      { roomNumber: '404', name: 'משאבי אנוש' },
    ],
    south: [
      { roomNumber: '405', name: 'מטה' },
      { roomNumber: '406', name: 'כספים' },
      { roomNumber: '407', name: 'פרויקטים' },
      { roomNumber: '408', name: 'חדר דיונים' },
    ],
  },
  {
    floorNumber: 5,
    displayName: 'קומה 5 - מעבדות ומחקר',
    north: [
      { roomNumber: '501', name: 'מעבדות מתקדמות' },
      { roomNumber: '502', name: 'חדשנות' },
      { roomNumber: '503', name: 'ניסויים' },
      { roomNumber: '504', name: 'סימולציה' },
    ],
    south: [
      { roomNumber: '505', name: 'צוותי מחקר' },
      { roomNumber: '506', name: 'חדר שרתים' },
      { roomNumber: '507', name: 'מחסן מאובטח' },
      { roomNumber: '508', name: 'מעבדת חומרה' },
    ],
  },
];

/** חדרי מקור בבסיסים המפונים. */
export const SOURCE_ROOMS: Array<{
  baseCode: string;
  unitCode: string;
  teamCode: string;
  building: string;
  floor: string;
  roomNumber: string;
  displayName: string;
}> = [
  { baseCode: 'GDN', unitCode: 'GDN-TECH', teamCode: 'DEV-A', building: 'בניין 7', floor: '1', roomNumber: '12', displayName: 'חדר פיתוח א׳ - גדעונים' },
  { baseCode: 'GDN', unitCode: 'GDN-TECH', teamCode: 'DEV-B', building: 'בניין 7', floor: '1', roomNumber: '14', displayName: 'חדר פיתוח ב׳ - גדעונים' },
  { baseCode: 'GDN', unitCode: 'GDN-TECH', teamCode: 'CYBER', building: 'בניין 7', floor: '2', roomNumber: '21', displayName: 'מעבדת סייבר - גדעונים' },
  { baseCode: 'GDN', unitCode: 'GDN-LOG', teamCode: 'NET', building: 'בניין 9', floor: '1', roomNumber: '3', displayName: 'מעבדת רשת - גדעונים' },
  { baseCode: 'GDN', unitCode: 'GDN-LOG', teamCode: 'LOG-GDN', building: 'בניין 9', floor: '1', roomNumber: '5', displayName: 'מחסן לוגיסטי - גדעונים' },

  { baseCode: 'TZR', unitCode: 'TZR-OPS', teamCode: 'NOC', building: 'בניין 3', floor: '1', roomNumber: '8', displayName: 'חדר NOC - צריפין' },
  { baseCode: 'TZR', unitCode: 'TZR-OPS', teamCode: 'SUPPORT', building: 'בניין 3', floor: '1', roomNumber: '10', displayName: 'תמיכה טכנית - צריפין' },
  { baseCode: 'TZR', unitCode: 'TZR-OPS', teamCode: 'INTEG', building: 'בניין 3', floor: '2', roomNumber: '22', displayName: 'אינטגרציה - צריפין' },
  { baseCode: 'TZR', unitCode: 'TZR-LAB', teamCode: 'LAB', building: 'בניין 5', floor: '1', roomNumber: '2', displayName: 'מעבדת חומרה - צריפין' },

  { baseCode: 'SHL', unitCode: 'SHL-HQ', teamCode: 'HR', building: 'בניין מנהלה', floor: '1', roomNumber: '105', displayName: 'משאבי אנוש - השלישות' },
  { baseCode: 'SHL', unitCode: 'SHL-HQ', teamCode: 'FIN', building: 'בניין מנהלה', floor: '1', roomNumber: '107', displayName: 'כספים - השלישות' },
  { baseCode: 'SHL', unitCode: 'SHL-HQ', teamCode: 'PLAN', building: 'בניין מנהלה', floor: '2', roomNumber: '204', displayName: 'תכנון - השלישות' },
  { baseCode: 'SHL', unitCode: 'SHL-LOG', teamCode: 'LOG-SHL', building: 'בניין מחסנים', floor: '1', roomNumber: '1', displayName: 'מחסן ציוד - השלישות' },
];

export const UNITS = [
  { code: 'KT-HQ', name: 'מטה קריית התקשוב', baseCode: 'KT', type: 'UNIT' },
  { code: 'KT-LOG', name: 'מדור לוגיסטיקה', baseCode: 'KT', type: 'SECTION' },
  { code: 'GDN-TECH', name: 'ענף טכנולוגיות - גדעונים', baseCode: 'GDN', type: 'BRANCH' },
  { code: 'GDN-LOG', name: 'מדור לוגיסטיקה - גדעונים', baseCode: 'GDN', type: 'SECTION' },
  { code: 'TZR-OPS', name: 'ענף מבצעים - צריפין', baseCode: 'TZR', type: 'BRANCH' },
  { code: 'TZR-LAB', name: 'מדור מעבדות - צריפין', baseCode: 'TZR', type: 'SECTION' },
  { code: 'SHL-HQ', name: 'מנהלה - השלישות', baseCode: 'SHL', type: 'BRANCH' },
  { code: 'SHL-LOG', name: 'מדור אספקה - השלישות', baseCode: 'SHL', type: 'SECTION' },
] as const;

export const TEAMS = [
  { code: 'DEV-A', name: 'צוות פיתוח א׳', unitCode: 'GDN-TECH' },
  { code: 'DEV-B', name: 'צוות פיתוח ב׳', unitCode: 'GDN-TECH' },
  { code: 'CYBER', name: 'צוות סייבר', unitCode: 'GDN-TECH' },
  { code: 'NET', name: 'צוות רשתות', unitCode: 'GDN-LOG' },
  { code: 'LOG-GDN', name: 'צוות לוגיסטיקה גדעונים', unitCode: 'GDN-LOG' },
  { code: 'NOC', name: 'צוות NOC', unitCode: 'TZR-OPS' },
  { code: 'SUPPORT', name: 'צוות תמיכה', unitCode: 'TZR-OPS' },
  { code: 'INTEG', name: 'צוות אינטגרציה', unitCode: 'TZR-OPS' },
  { code: 'LAB', name: 'צוות מעבדה', unitCode: 'TZR-LAB' },
  { code: 'HR', name: 'צוות משאבי אנוש', unitCode: 'SHL-HQ' },
  { code: 'FIN', name: 'צוות כספים', unitCode: 'SHL-HQ' },
  { code: 'PLAN', name: 'צוות תכנון', unitCode: 'SHL-HQ' },
  { code: 'LOG-SHL', name: 'צוות אספקה השלישות', unitCode: 'SHL-LOG' },
  { code: 'KT-LOGT', name: 'צוות קליטה קריית התקשוב', unitCode: 'KT-LOG' },
] as const;

export const DEMO_USERS = [
  {
    identityNumber: '9000001',
    fullName: 'סרן דנה אביב',
    email: 'commander@south.demo',
    role: 'LOGISTICS_COMMANDER',
    baseCode: 'KT',
    teamCode: null,
    description: 'מפקדת הלוגיסטיקה - רואה את כל המבצע',
  },
  {
    identityNumber: '9000002',
    fullName: 'רס״ל אלה מאיר',
    email: 'soldier.gdn@south.demo',
    role: 'LOGISTICS_SOLDIER',
    baseCode: 'GDN',
    teamCode: 'LOG-GDN',
    description: 'חיילת לוגיסטיקה בגדעונים - אורזת ומשנעת',
  },
  {
    identityNumber: '9000003',
    fullName: 'סמל עידן שגב',
    email: 'soldier.tzr@south.demo',
    role: 'LOGISTICS_SOLDIER',
    baseCode: 'TZR',
    teamCode: 'SUPPORT',
    description: 'חייל לוגיסטיקה בצריפין',
  },
  {
    identityNumber: '9000004',
    fullName: 'רב״ט נטע אלון',
    email: 'soldier.kt@south.demo',
    role: 'LOGISTICS_SOLDIER',
    baseCode: 'KT',
    teamCode: 'KT-LOGT',
    description: 'חייל קליטה בקריית התקשוב - קולט ומפזר',
  },
  {
    identityNumber: '9000005',
    fullName: 'סרן רועי לוי',
    email: 'teamlead.dev@south.demo',
    role: 'TEAM_LEAD',
    baseCode: 'GDN',
    teamCode: 'DEV-A',
    description: 'ראש צוות פיתוח א׳ - רואה רק את אריזות הצוות',
  },
  {
    identityNumber: '9000006',
    fullName: 'סגן מאיה כהן',
    email: 'teamlead.lab@south.demo',
    role: 'TEAM_LEAD',
    baseCode: 'TZR',
    teamCode: 'LAB',
    description: 'ראשת צוות מעבדה',
  },
] as const;

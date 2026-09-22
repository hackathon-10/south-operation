import type { UserRole } from '@south/shared';

/** המשתמש המאומת שמצורף לכל בקשה לאחר בדיקת ה-Access Token. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  baseId: string | null;
  teamId: string | null;
  /** הצוותים שבתחום ההרשאה של המשתמש: הצוות שלו + צוותים שהוא ראש שלהם. */
  teamIds: string[];
}

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  /** מזהה סשן - מאפשר לקשר Access Token לסשן Refresh פעיל. */
  sid: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  iat?: number;
  exp?: number;
}

export const REFRESH_COOKIE_NAME = 'south_refresh';

import { ExecutionContext, SetMetadata, createParamDecorator } from '@nestjs/common';
import type { UserRole } from '@south/shared';
import type { Request } from 'express';
import type { AuthenticatedUser } from './auth.types';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

/** נתיב שאינו דורש התחברות (login, health). כל השאר מוגן כברירת מחדל. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * NoCyberHere: AUTHORIZATION
 * Threat: גישה לפעולה שאינה מתאימה לתפקיד המשתמש
 * Reason: אכיפת RBAC בשרת. הסתרת כפתורים בצד הלקוח אינה מנגנון אבטחה.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user as AuthenticatedUser;
    return data ? user?.[data] : user;
  },
);

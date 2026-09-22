import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@south/shared';
import type { Request } from 'express';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { IS_PUBLIC_KEY, ROLES_KEY } from './decorators';
import { TokenService } from './token.service';
import type { AuthenticatedUser } from './auth.types';

/**
 * NoCyberHere: AUTHENTICATION
 * Threat: גישה לא מאומתת ל-API, ושימוש ב-Token של משתמש שהושבת
 * Reason: כל נתיב מוגן כברירת מחדל. ה-Token מאומת, והמשתמש נטען מהמסד בכל בקשה
 *         כדי שהשבתת משתמש תיכנס לתוקף מיידית.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger('Auth');

  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const header = request.header('authorization');

    if (!header?.startsWith('Bearer ')) {
      throw new AppException('NOT_AUTHENTICATED');
    }

    const payload = await this.tokens.verifyAccessToken(header.slice('Bearer '.length).trim());

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        baseId: true,
        teamId: true,
        isActive: true,
        ledTeams: { select: { id: true } },
      },
    });

    if (!user) {
      throw new AppException('NOT_AUTHENTICATED');
    }
    if (!user.isActive) {
      this.logger.warn(`ניסיון גישה של משתמש מושבת ${user.id}`);
      throw new AppException('ACCOUNT_DISABLED');
    }

    const teamIds = new Set<string>(user.ledTeams.map((team) => team.id));
    if (user.teamId) teamIds.add(user.teamId);

    request.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role as UserRole,
      baseId: user.baseId,
      teamId: user.teamId,
      teamIds: [...teamIds],
    };

    return true;
  }
}

/**
 * NoCyberHere: AUTHORIZATION
 * Threat: הסלמת הרשאות - משתמש שמנסה לבצע פעולה של תפקיד אחר
 * Reason: בדיקת התפקיד הנדרש בשרת לפני הרצת ה-Handler, עם רישום לניסיון שנדחה.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger('Authorization');

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) throw new AppException('NOT_AUTHENTICATED');

    if (!requiredRoles.includes(user.role)) {
      this.logger.warn(
        `נדחתה גישה: משתמש ${user.id} בתפקיד ${user.role} ניסה ${request.method} ${request.url}`,
      );
      throw new AppException('FORBIDDEN_ROLE');
    }

    return true;
  }
}

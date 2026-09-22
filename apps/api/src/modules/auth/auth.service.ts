import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AuditAction,
  AuthUserDto,
  DEFAULT_DEMO_PASSWORD,
  DemoUserDto,
  LoginInput,
  LoginResponseDto,
  USER_ROLE_LABEL,
  UserRole,
} from '@south/shared';
import { APP_CONFIG, AppConfig } from '../../common/config/env.config';
import { AppException } from '../../common/errors/app.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

/** האש דמה שמשמש להשוואה גם כשהמשתמש לא נמצא, כדי למנוע מנייה לפי זמן תגובה. */
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0c2FsdA$Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6cXV4Zm9v';

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * NoCyberHere: AUTHENTICATION
   * Threat: Brute force, User enumeration, גישה עם חשבון מושבת
   * Reason: אותה הודעת שגיאה לכל כישלון, השוואת האש גם כשהמשתמש לא קיים,
   *         ורישום כל ניסיון שנכשל ל-Audit Log (בלי הסיסמה עצמה).
   */
  async login(
    input: LoginInput,
    context: { ip?: string; userAgent?: string },
  ): Promise<{ response: LoginResponseDto; refreshToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      include: { base: { select: { name: true } }, team: { select: { name: true } } },
    });

    const passwordMatches = await this.passwords.verify(
      user?.passwordHash ?? DUMMY_HASH,
      input.password,
    );

    if (!user || !passwordMatches) {
      await this.audit.record({
        actorUserId: user?.id ?? null,
        action: AuditAction.LOGIN_FAILED,
        entityType: 'User',
        entityId: user?.id ?? null,
        // לא נשמרת הסיסמה ולא האימייל המלא.
        metadata: { reason: user ? 'BAD_PASSWORD' : 'UNKNOWN_USER', userAgent: context.userAgent },
      });
      throw new AppException('INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      await this.audit.record({
        actorUserId: user.id,
        action: AuditAction.LOGIN_FAILED,
        entityType: 'User',
        entityId: user.id,
        metadata: { reason: 'ACCOUNT_DISABLED' },
      });
      throw new AppException('ACCOUNT_DISABLED');
    }

    const issued = await this.tokens.issueTokens(user.id, user.role as UserRole);

    await this.audit.record({
      actorUserId: user.id,
      action: AuditAction.LOGIN_SUCCESS,
      entityType: 'User',
      entityId: user.id,
      metadata: { role: user.role, userAgent: context.userAgent },
    });

    return {
      refreshToken: issued.refreshToken,
      response: {
        accessToken: issued.accessToken,
        expiresInSeconds: issued.accessExpiresInSeconds,
        user: this.toAuthUser(user),
      },
    };
  }

  async refresh(refreshToken: string | undefined): Promise<{
    response: LoginResponseDto;
    refreshToken: string;
  }> {
    if (!refreshToken) throw new AppException('INVALID_REFRESH_TOKEN');

    const rotated = await this.tokens.rotateRefreshToken(refreshToken);
    const user = await this.prisma.user.findUnique({
      where: { id: rotated.userId },
      include: { base: { select: { name: true } }, team: { select: { name: true } } },
    });
    if (!user) throw new AppException('INVALID_REFRESH_TOKEN');

    await this.audit.record({
      actorUserId: user.id,
      action: AuditAction.TOKEN_REFRESHED,
      entityType: 'User',
      entityId: user.id,
    });

    return {
      refreshToken: rotated.refreshToken,
      response: {
        accessToken: rotated.accessToken,
        expiresInSeconds: rotated.accessExpiresInSeconds,
        user: this.toAuthUser(user),
      },
    };
  }

  async logout(refreshToken: string | undefined, userId?: string): Promise<void> {
    if (refreshToken) {
      const sessionId = await this.tokens.sessionIdFromRefreshToken(refreshToken);
      if (sessionId) await this.tokens.revokeSession(sessionId);
    }
    if (userId) {
      await this.audit.record({
        actorUserId: userId,
        action: AuditAction.LOGOUT,
        entityType: 'User',
        entityId: userId,
      });
    }
  }

  async me(userId: string): Promise<AuthUserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { base: { select: { name: true } }, team: { select: { name: true } } },
    });
    if (!user) throw new AppException('USER_NOT_FOUND');
    return this.toAuthUser(user);
  }

  /**
   * רשימת משתמשי הדמו למסך בחירת משתמש.
   * זמין רק כאשר ENABLE_DEMO_LOGIN=true (פיתוח והדגמה).
   * אינו מדלג על ההתחברות: המשתמש עדיין נדרש לשלוח סיסמה ל-/auth/login.
   */
  async demoUsers(): Promise<{ users: DemoUserDto[]; demoPassword: string | null }> {
    if (!this.config.ENABLE_DEMO_LOGIN) {
      throw new AppException('DEMO_LOGIN_DISABLED');
    }

    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
      select: {
        email: true,
        fullName: true,
        role: true,
        base: { select: { name: true } },
        team: { select: { name: true } },
      },
    });

    // אותו כלל בדיוק כמו ב-Seed (prisma/seed.ts): אם לא הוגדרה סיסמת דמו מפורשת,
    // בפיתוח היא תמיד DEFAULT_DEMO_PASSWORD, ובפרודקשן היא אקראית ולא ידועה כאן.
    const demoPassword =
      this.config.SEED_DEMO_PASSWORD ?? (this.config.isProduction ? null : DEFAULT_DEMO_PASSWORD);

    return {
      demoPassword,
      users: users.map((user) => ({
        email: user.email,
        fullName: user.fullName,
        role: user.role as UserRole,
        description: [USER_ROLE_LABEL[user.role as UserRole], user.base?.name, user.team?.name]
          .filter(Boolean)
          .join(' · '),
      })),
    };
  }

  private toAuthUser(user: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    baseId: string | null;
    teamId: string | null;
    base?: { name: string } | null;
    team?: { name: string } | null;
  }): AuthUserDto {
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role as UserRole,
      baseId: user.baseId,
      baseName: user.base?.name ?? null,
      teamId: user.teamId,
      teamName: user.team?.name ?? null,
    };
  }
}

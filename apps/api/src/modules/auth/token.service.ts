import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import type { UserRole } from '@south/shared';
import { APP_CONFIG, AppConfig } from '../../common/config/env.config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import type { JwtSignOptions } from '@nestjs/jwt';
import type { AccessTokenPayload, RefreshTokenPayload } from './auth.types';

/** ה-TTL מגיע כמחרוזת מאומתת מהסביבה (למשל "15m"), ו-jsonwebtoken מצפה לטיפוס פנימי. */
function signOptions(secret: string, expiresIn: string): JwtSignOptions {
  return { secret, expiresIn } as JwtSignOptions;
}

/**
 * NoCyberHere: AUTHENTICATION
 * Threat: גניבה או שימוש חוזר ב-Tokens, והמשך גישה לאחר התנתקות
 * Reason: Access Token קצר מועד; Refresh Token נשמר כ-SHA-256 hash בלבד,
 *         מסובב בכל רענון (rotation) וניתן לביטול מיידי בהתנתקות.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async issueTokens(userId: string, role: UserRole): Promise<{
    accessToken: string;
    refreshToken: string;
    sessionId: string;
    accessExpiresInSeconds: number;
  }> {
    return this.issueTokensInTransaction(this.prisma, userId, role);
  }

  private async issueTokensInTransaction(
    tx: any,
    userId: string,
    role: UserRole,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    sessionId: string;
    accessExpiresInSeconds: number;
  }> {
    const sessionId = randomUUID();

    const accessToken = await this.jwt.signAsync(
      { sub: userId, role, sid: sessionId } satisfies AccessTokenPayload,
      signOptions(this.config.JWT_ACCESS_SECRET, this.config.JWT_ACCESS_TTL),
    );

    const refreshToken = await this.jwt.signAsync(
      { sub: userId, sid: sessionId } satisfies RefreshTokenPayload,
      signOptions(this.config.JWT_REFRESH_SECRET, this.config.JWT_REFRESH_TTL),
    );

    const decoded = this.jwt.decode(refreshToken) as { exp: number };

    await tx.refreshSession.create({
      data: {
        id: sessionId,
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(decoded.exp * 1000),
      },
    });

    const accessDecoded = this.jwt.decode(accessToken) as { exp: number; iat: number };

    return {
      accessToken,
      refreshToken,
      sessionId,
      accessExpiresInSeconds: accessDecoded.exp - accessDecoded.iat,
    };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      return await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.JWT_ACCESS_SECRET,
      });
    } catch {
      throw new AppException('SESSION_EXPIRED');
    }
  }

  /**
   * מאמת Refresh Token מול הסשן השמור, מבטל אותו ומנפיק זוג Tokens חדש.
   * שימוש חוזר ב-Token מבוטל נכשל מיידית.
   */
  async rotateRefreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    userId: string;
    accessExpiresInSeconds: number;
  }> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.config.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new AppException('INVALID_REFRESH_TOKEN');
    }

    const tokenHash = this.hashToken(refreshToken);

    return this.prisma.$transaction(async (tx) => {
      const session = await tx.refreshSession.findUnique({
        where: { id: payload.sid },
        include: { user: { select: { id: true, role: true, isActive: true } } },
      });

      if (!session || session.revokedAt || session.tokenHash !== tokenHash) {
        if (session && session.tokenHash !== tokenHash) {
          await tx.refreshSession.updateMany({
            where: { userId: session.userId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
        throw new AppException('INVALID_REFRESH_TOKEN');
      }

      if (session.expiresAt.getTime() < Date.now()) {
        await tx.refreshSession.updateMany({
          where: { id: session.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        throw new AppException('INVALID_REFRESH_TOKEN');
      }

      if (!session.user.isActive) {
        throw new AppException('ACCOUNT_DISABLED');
      }

      const revoked = await tx.refreshSession.updateMany({
        where: {
          id: session.id,
          tokenHash,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { revokedAt: new Date() },
      });

      if (revoked.count !== 1) {
        throw new AppException('INVALID_REFRESH_TOKEN');
      }

      const issued = await this.issueTokensInTransaction(tx, session.userId, session.user.role as UserRole);
      return {
        accessToken: issued.accessToken,
        refreshToken: issued.refreshToken,
        userId: session.userId,
        accessExpiresInSeconds: issued.accessExpiresInSeconds,
      };
    });
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async sessionIdFromRefreshToken(refreshToken: string): Promise<string | null> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.config.JWT_REFRESH_SECRET,
      });
      return payload.sid;
    } catch {
      return null;
    }
  }
}

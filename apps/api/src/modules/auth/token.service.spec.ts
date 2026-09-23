import { TokenService } from './token.service';

describe('TokenService refresh rotation', () => {
  it('uses an atomic single-use claim when rotating a refresh token', async () => {
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1', sid: 'session-1' }),
      decode: jest.fn(),
    };

    const tx = {
      refreshSession: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'session-1',
          userId: 'user-1',
          tokenHash: 'hash-abc',
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
          user: { id: 'user-1', role: 'LOGISTICS_SOLDIER', isActive: true },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const prisma = {
      $transaction: jest.fn(async (cb) => cb(tx)),
      refreshSession: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    };

    const service = new TokenService(
      jwt as any,
      prisma as any,
      {
        JWT_ACCESS_SECRET: 'access-secret-should-be-at-least-32-long',
        JWT_REFRESH_SECRET: 'refresh-secret-should-be-at-least-32-long',
        JWT_ACCESS_TTL: '15m',
        JWT_REFRESH_TTL: '7d',
      } as any,
    );

    jest.spyOn(service as any, 'hashToken').mockReturnValue('hash-abc');
    jest.spyOn(service as any, 'issueTokensInTransaction').mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      sessionId: 'new-session',
      accessExpiresInSeconds: 900,
    });

    await service.rotateRefreshToken('refresh-token');

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.refreshSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'session-1',
          tokenHash: 'hash-abc',
          revokedAt: null,
          expiresAt: expect.objectContaining({
            gt: expect.any(Date),
          }),
        }),
        data: expect.objectContaining({
          revokedAt: expect.any(Date),
        }),
      }),
    );
  });
});

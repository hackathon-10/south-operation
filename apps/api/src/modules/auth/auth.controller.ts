import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { LoginInput, loginSchema } from '@south/shared';
import type { Request, Response } from 'express';
import { APP_CONFIG, AppConfig } from '../../common/config/env.config';
import { ZodValidationPipe } from '../../common/validation/zod.pipe';
import { AuthService } from './auth.service';
import { REFRESH_COOKIE_NAME } from './auth.types';
import { CurrentUser, Public } from './decorators';
import type { AuthenticatedUser } from './auth.types';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * NoCyberHere: AUTHENTICATION
   * Threat: Brute force על מסך ההתחברות
   * Reason: הגבלת קצב הדוקה יותר מברירת המחדל בנתיב ההתחברות.
   */
  @Public()
  @Throttle({ auth: { limit: 10, ttl: 900_000 } })
  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'התחברות למערכת',
    description:
      'מחזיר Access Token קצר מועד, ומגדיר Refresh Token ב-cookie מסוג HttpOnly. ' +
      'שגיאה מוחזרת באותו נוסח גם כשהמשתמש אינו קיים וגם כשהסיסמה שגויה.',
  })
  @ApiOkResponse({ description: 'התחברות הצליחה' })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(body, {
      ip: request.ip,
      userAgent: request.header('user-agent')?.slice(0, 120),
    });
    this.setRefreshCookie(response, result.refreshToken);
    return result.response;
  }

  @Public()
  @Throttle({ auth: { limit: 60, ttl: 900_000 } })
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({
    summary: 'חידוש Access Token',
    description: 'משתמש ב-Refresh Token מה-cookie, מסובב אותו ומנפיק Access Token חדש.',
  })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = request.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    const result = await this.auth.refresh(token);
    this.setRefreshCookie(response, result.refreshToken);
    return result.response;
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'התנתקות', description: 'מבטל את סשן ה-Refresh ומוחק את ה-cookie.' })
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = request.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    const user = (request as Request & { user?: AuthenticatedUser }).user;
    await this.auth.logout(token, user?.id);
    response.clearCookie(REFRESH_COOKIE_NAME, this.cookieOptions());
  }

  @Get('me')
  @ApiOperation({ summary: 'המשתמש המחובר', description: 'פרטי המשתמש, תפקידו ושיוכו הארגוני.' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id);
  }

  @Public()
  @Get('demo-users')
  @ApiOperation({
    summary: 'משתמשי דמו',
    description:
      'רשימת משתמשי ההדגמה למסך בחירת משתמש. זמין רק כאשר ENABLE_DEMO_LOGIN=true. ' +
      'אינו מדלג על ההתחברות - עדיין נדרשת סיסמה.',
  })
  demoUsers() {
    return this.auth.demoUsers();
  }

  /**
   * NoCyberHere: CSRF_PROTECTION
   * Threat: Cross-site request forgery על בסיס cookie
   * Reason: ה-cookie הוא HttpOnly + SameSite=Strict (Lax בפיתוח לצורך פורטים שונים),
   *         ו-Secure בפרודקשן. ה-Access Token נשלח בכותרת Authorization ולא ב-cookie,
   *         ולכן בקשות חוצות-אתר אינן יכולות לבצע פעולות בשם המשתמש.
   */
  private setRefreshCookie(response: Response, refreshToken: string): void {
    response.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      ...this.cookieOptions(),
      maxAge: this.refreshMaxAgeMs(),
    });
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: this.config.isProduction ? ('strict' as const) : ('lax' as const),
      path: '/api/v1/auth',
    };
  }

  private refreshMaxAgeMs(): number {
    const ttl = this.config.JWT_REFRESH_TTL;
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const value = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return value * multipliers[unit];
  }
}

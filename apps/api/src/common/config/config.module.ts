import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, loadConfig } from './env.config';

/**
 * קונפיגורציה גלובלית מאומתת.
 * נטענת פעם אחת בעליית האפליקציה; אם משתנה סביבה חסר או חלש, השרת לא יעלה.
 */
@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig() }],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}

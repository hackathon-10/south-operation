import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { API_PREFIX, createApp } from './bootstrap';
import { APP_CONFIG, AppConfig } from './common/config/env.config';

async function bootstrap(): Promise<void> {
  const app = await createApp();
  const config = app.get<AppConfig>(APP_CONFIG);

  await app.listen(config.PORT, '0.0.0.0');

  const logger = new Logger('Bootstrap');
  logger.log(`API עלה על פורט ${config.PORT} (${config.NODE_ENV})`);
  logger.log(`נתיב בסיס: /${API_PREFIX}`);
  if (config.swaggerEnabled) logger.log('תיעוד Swagger: /api/docs');
}

void bootstrap();

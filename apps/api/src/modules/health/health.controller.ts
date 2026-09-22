import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthDto } from '@south/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Public } from '../auth/decorators';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'בדיקת חיות',
    description: 'בודק גם את החיבור למסד הנתונים. אינו חושף פרטי חיבור או גרסאות תלויות.',
  })
  async health(): Promise<HealthDto> {
    const databaseUp = await this.prisma.isHealthy();
    return {
      status: databaseUp ? 'ok' : 'degraded',
      uptimeSeconds: Math.round(process.uptime()),
      database: databaseUp ? 'up' : 'down',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }
}

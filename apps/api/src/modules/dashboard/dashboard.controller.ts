import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@south/shared';
import { CurrentUser, Roles } from '../auth/decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('commander')
  @Roles(UserRole.LOGISTICS_COMMANDER)
  @ApiOperation({
    summary: 'תמונת מצב למפקד לוגיסטיקה',
    description: 'משימות, אריזות, שליחויות, התקדמות לפי בסיס, זמני ממוצע ובקשות ממתינות.',
  })
  commander() {
    return this.dashboard.commander();
  }

  @Get('operation')
  @Roles(UserRole.OPERATION_COMMANDER)
  @ApiOperation({
    summary: 'תמונת מאקרו למפקד המבצע',
    description:
      'מצב כל הבסיסים והיחידות הארגוניות: התקדמות, חיווי בריאות והחלטות שממתינות לאישור.',
  })
  operation() {
    return this.dashboard.operation();
  }

  @Get('soldier')
  @Roles(UserRole.LOGISTICS_SOLDIER)
  @ApiOperation({
    summary: 'הבית של חייל הלוגיסטיקה',
    description: 'המשימה הבאה, משימות פעילות, אריזות פתוחות ושליחויות משויכות.',
  })
  soldier(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.soldier(user);
  }

  @Get('team-lead')
  @Roles(UserRole.TEAM_LEAD)
  @ApiOperation({
    summary: 'תמונת מצב לראש צוות',
    description: 'אריזות הצוות בלבד, לפי סטטוס והתקדמות.',
  })
  teamLead(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.teamLead(user);
  }
}

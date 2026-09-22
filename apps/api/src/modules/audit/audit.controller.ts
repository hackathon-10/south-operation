import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditLogsQuery, UserRole, auditLogsQuerySchema } from '@south/shared';
import { ZodQuery } from '../../common/validation/zod.decorators';
import { Roles } from '../auth/decorators';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@Controller('audit-logs')
// רק מפקד לוגיסטיקה רשאי לצפות ביומן הפעולות.
@Roles(UserRole.LOGISTICS_COMMANDER)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({
    summary: 'יומן פעולות',
    description: 'מציג את הפעולות המשמעותיות במערכת. מיועד למפקד הלוגיסטיקה בלבד.',
  })
  @ApiOkResponse({ description: 'רשימת רשומות Audit עם Pagination' })
  list(@ZodQuery(auditLogsQuerySchema, 'AuditLogsQuery') query: AuditLogsQuery) {
    return this.audit.list(query);
  }
}

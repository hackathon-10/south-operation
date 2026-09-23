import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { UserRole, joinRequestsQuerySchema, reviewJoinRequestSchema } from '@south/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/validation/zod.pipe';
import { ZodQuery } from '../../common/validation/zod.decorators';
import { CurrentUser, Roles } from '../auth/decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JoinRequestsService } from './join-requests.service';

@ApiTags('Mission Join Requests')
@Controller('mission-join-requests')
export class JoinRequestsController {
  constructor(private readonly joinRequests: JoinRequestsService) {}

  @Get()
  @ApiOperation({
    summary: 'בקשות הצטרפות',
    description: 'מפקד רואה את כל הבקשות; חייל רואה רק את הבקשות שהוא יצר.',
  })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @ZodQuery(joinRequestsQuerySchema, 'JoinRequestsQuery')
    query: z.infer<typeof joinRequestsQuerySchema>,
  ) {
    return this.joinRequests.list(user, query);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @Roles(UserRole.LOGISTICS_COMMANDER, UserRole.OPERATION_COMMANDER)
  @ApiParam({ name: 'id', description: 'מזהה הבקשה' })
  @ApiOperation({
    summary: 'אישור בקשה',
    description: 'מוסיף או מאחד עצירת איסוף, משייך את האריזות ומחשב מסלול מחדש ב-transaction אחת.',
  })
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(reviewJoinRequestSchema))
    body: z.infer<typeof reviewJoinRequestSchema>,
  ) {
    return this.joinRequests.approve(user, id, body.note);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @Roles(UserRole.LOGISTICS_COMMANDER, UserRole.OPERATION_COMMANDER)
  @ApiParam({ name: 'id', description: 'מזהה הבקשה' })
  @ApiOperation({ summary: 'דחיית בקשה' })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(reviewJoinRequestSchema))
    body: z.infer<typeof reviewJoinRequestSchema>,
  ) {
    return this.joinRequests.reject(user, id, body.note);
  }
}

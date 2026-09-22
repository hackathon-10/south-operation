import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  CreatePackingTaskInput,
  PackingTasksQuery,
  UpdatePackingTaskInput,
  UserRole,
  cancelPackingTaskSchema,
  createPackageSchema,
  createPackingTaskSchema,
  packingTasksQuerySchema,
  updatePackingTaskSchema,
} from '@south/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/validation/zod.pipe';
import { ZodBody, ZodQuery } from '../../common/validation/zod.decorators';
import { CurrentUser, Roles } from '../auth/decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PackagesService } from '../packages/packages.service';
import { PackingTasksService } from './packing-tasks.service';

@ApiTags('Packing Tasks')
@Controller('packing-tasks')
export class PackingTasksController {
  constructor(
    private readonly tasks: PackingTasksService,
    private readonly packages: PackagesService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'רשימת משימות אריזה',
    description:
      'חייל מקבל רק את המשימות שלו, ראש צוות רק את משימות הצוותים שלו, ומפקד רואה הכל.',
  })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @ZodQuery(packingTasksQuerySchema, 'PackingTasksQuery') query: PackingTasksQuery,
  ) {
    return this.tasks.list(user, query);
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'מזהה המשימה' })
  @ApiOperation({ summary: 'פרטי משימת אריזה', description: 'כולל שורות, התקדמות ואריזות.' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) taskId: string) {
    return this.tasks.get(user, taskId);
  }

  @Post()
  @Roles(UserRole.LOGISTICS_COMMANDER)
  @ApiOperation({
    summary: 'יצירת משימת אריזה',
    description:
      'מפקד לוגיסטיקה בוחר חדר מקור, חדר יעד, צוות, חייל מבצע ואת הפריטים המדויקים. ' +
      'היצירה משריינת את הפריטים והכמויות ב-transaction אחת.',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @ZodBody(createPackingTaskSchema, 'CreatePackingTask', {
      sourceRoomId: '00000000-0000-0000-0000-000000000000',
      destinationRoomId: '00000000-0000-0000-0000-000000000000',
      teamId: '00000000-0000-0000-0000-000000000000',
      assignedSoldierId: '00000000-0000-0000-0000-000000000000',
      priority: 'HIGH',
      notes: 'לארוז את עמדות מעבדת הרשת',
      lines: [
        {
          productCatalogItemId: '00000000-0000-0000-0000-000000000000',
          assetInstanceId: '00000000-0000-0000-0000-000000000000',
          requestedQuantity: 1,
        },
        { productCatalogItemId: '00000000-0000-0000-0000-000000000000', requestedQuantity: 8 },
      ],
    })
    body: CreatePackingTaskInput,
  ) {
    return this.tasks.create(user, body);
  }

  @Patch(':id')
  @Roles(UserRole.LOGISTICS_COMMANDER)
  @ApiParam({ name: 'id', description: 'מזהה המשימה' })
  @ApiOperation({ summary: 'עדכון משימה', description: 'דחיפות, יעד לביצוע, הערה או חייל מבצע.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) taskId: string,
    @ZodBody(updatePackingTaskSchema, 'UpdatePackingTask') body: UpdatePackingTaskInput,
  ) {
    return this.tasks.update(user, taskId, body);
  }

  @Post(':id/start')
  @HttpCode(200)
  @ApiParam({ name: 'id', description: 'מזהה המשימה' })
  @ApiOperation({ summary: 'התחלת משימה', description: 'מעביר את המשימה ל"בביצוע".' })
  start(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) taskId: string) {
    return this.tasks.start(user, taskId);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Roles(UserRole.LOGISTICS_COMMANDER)
  @ApiParam({ name: 'id', description: 'מזהה המשימה' })
  @ApiOperation({
    summary: 'ביטול משימה',
    description: 'משחרר שריונים של ציוד שטרם נארז. נכשל אם קיימות אריזות עם תכולה.',
  })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) taskId: string,
    @Body(new ZodValidationPipe(cancelPackingTaskSchema))
    body: z.infer<typeof cancelPackingTaskSchema>,
  ) {
    return this.tasks.cancel(user, taskId, body.reason);
  }

  @Post(':taskId/packages')
  @ApiParam({ name: 'taskId', description: 'מזהה המשימה' })
  @ApiOperation({
    summary: 'יצירת אריזה מתוך משימה',
    description: 'החייל בוחר סוג אריזה. המשימה עוברת אוטומטית ל"בביצוע".',
  })
  createPackage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @ZodBody(createPackageSchema, 'CreatePackage', { packageType: 'PROFESSIONAL_BOX' })
    body: z.infer<typeof createPackageSchema>,
  ) {
    return this.packages.createFromTask(user, taskId, body);
  }
}

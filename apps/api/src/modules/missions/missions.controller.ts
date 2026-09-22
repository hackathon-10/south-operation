import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  CreateJoinRequestInput,
  CreateMissionInput,
  MissionsQuery,
  ReorderStopsInput,
  ScanActionInput,
  UpdateMissionInput,
  UserRole,
  createJoinRequestSchema,
  createMissionSchema,
  missionActionSchema,
  missionPackagesSchema,
  missionsQuerySchema,
  reorderStopsSchema,
  routeSuggestionSchema,
  updateMissionSchema,
} from '@south/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/validation/zod.pipe';
import { ZodBody, ZodQuery } from '../../common/validation/zod.decorators';
import { CurrentUser, Roles } from '../auth/decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JoinRequestsService } from './join-requests.service';
import { MissionsExecutionService } from './missions-execution.service';
import { MissionsService } from './missions.service';

@ApiTags('Transport Missions')
@Controller('missions')
export class MissionsController {
  constructor(
    private readonly missions: MissionsService,
    private readonly execution: MissionsExecutionService,
    private readonly joinRequests: JoinRequestsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'רשימת שליחויות',
    description: 'חייל רואה שליחויות שלו או כאלה שעוברות בבסיס שלו. ראש צוות אינו מורשה.',
  })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @ZodQuery(missionsQuerySchema, 'MissionsQuery') query: MissionsQuery,
  ) {
    return this.missions.list(user, query);
  }

  @Post('route-suggestions')
  @HttpCode(200)
  @Roles(UserRole.LOGISTICS_COMMANDER)
  @ApiOperation({
    summary: 'הצעת מסלול',
    description:
      'מקבץ אריזות לפי בסיס מקור, מדרג לפי דחיפות והמתנה, ומחזיר סדר עצירות, מרחק, זמן והסבר.',
  })
  suggestRoute(
    @ZodBody(routeSuggestionSchema, 'RouteSuggestion') body: z.infer<typeof routeSuggestionSchema>,
  ) {
    return this.missions.suggestRoute(body.packageIds);
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'מזהה השליחות' })
  @ApiOperation({ summary: 'פרטי שליחות', description: 'עצירות, אריזות, מסלול והסבר ההצעה.' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.missions.get(user, id);
  }

  @Post()
  @Roles(UserRole.LOGISTICS_COMMANDER)
  @ApiOperation({
    summary: 'יצירת שליחות',
    description:
      'בוחר אריזות מוכנות, בונה עצירות איסוף וחוזר לקריית התקשוב. ' +
      'ניתן לקבוע האם נדרשת נסיעה מאובטחת ולהוסיף הנחיות.',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @ZodBody(createMissionSchema, 'CreateMission', {
      title: 'איסוף מגדעונים וצריפין',
      plannedDepartureAt: '2026-02-01T06:30:00.000Z',
      vehicleType: 'TRUCK',
      licensePlate: '12-345-67',
      requiresSecuredTransport: true,
      securedTransportNotes: 'ליווי לפי נוהל, יציאה בשעות היום בלבד',
      packageIds: ['00000000-0000-0000-0000-000000000000'],
    })
    body: CreateMissionInput,
  ) {
    return this.missions.create(user, body);
  }

  @Patch(':id')
  @Roles(UserRole.LOGISTICS_COMMANDER)
  @ApiParam({ name: 'id', description: 'מזהה השליחות' })
  @ApiOperation({ summary: 'עדכון שליחות', description: 'מותר רק לפני היציאה לדרך.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @ZodBody(updateMissionSchema, 'UpdateMission') body: UpdateMissionInput,
  ) {
    return this.missions.update(user, id, body);
  }

  @Post(':id/packages')
  @HttpCode(200)
  @Roles(UserRole.LOGISTICS_COMMANDER)
  @ApiParam({ name: 'id', description: 'מזהה השליחות' })
  @ApiOperation({ summary: 'הוספת אריזות לשליחות' })
  addPackages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @ZodBody(missionPackagesSchema, 'MissionPackages') body: z.infer<typeof missionPackagesSchema>,
  ) {
    return this.missions.addPackages(user, id, body.packageIds);
  }

  @Delete(':id/packages/:packageId')
  @Roles(UserRole.LOGISTICS_COMMANDER)
  @ApiParam({ name: 'id', description: 'מזהה השליחות' })
  @ApiParam({ name: 'packageId', description: 'מזהה האריזה' })
  @ApiOperation({ summary: 'הסרת אריזה משליחות' })
  removePackage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('packageId', ParseUUIDPipe) packageId: string,
  ) {
    return this.missions.removePackage(user, id, packageId);
  }

  @Patch(':id/stops/reorder')
  @Roles(UserRole.LOGISTICS_COMMANDER)
  @ApiParam({ name: 'id', description: 'מזהה השליחות' })
  @ApiOperation({
    summary: 'שינוי סדר עצירות',
    description: 'סדר ידני של המפקד. המדדים מחושבים מחדש לפי הסדר שנקבע.',
  })
  reorderStops(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @ZodBody(reorderStopsSchema, 'ReorderStops') body: ReorderStopsInput,
  ) {
    return this.missions.reorderStops(user, id, body);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @Roles(UserRole.LOGISTICS_COMMANDER)
  @ApiParam({ name: 'id', description: 'מזהה השליחות' })
  @ApiOperation({ summary: 'ביטול שליחות', description: 'משחרר את האריזות חזרה למצב מוכן לשילוח.' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(missionActionSchema)) body: ScanActionInput,
  ) {
    return this.missions.cancel(user, id, body.note);
  }

  // ---------- ביצוע בשטח ----------

  @Post(':id/start-loading')
  @HttpCode(200)
  @ApiParam({ name: 'id', description: 'מזהה השליחות' })
  @ApiOperation({ summary: 'תחילת העמסה' })
  startLoading(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.execution.startLoading(user, id);
  }

  @Post(':id/stops/:stopId/arrive')
  @HttpCode(200)
  @ApiParam({ name: 'id', description: 'מזהה השליחות' })
  @ApiParam({ name: 'stopId', description: 'מזהה העצירה' })
  @ApiOperation({ summary: 'הגעה לעצירה' })
  arrive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stopId', ParseUUIDPipe) stopId: string,
  ) {
    return this.execution.arriveAtStop(user, id, stopId);
  }

  @Post(':id/packages/:packageId/load')
  @HttpCode(200)
  @ApiParam({ name: 'id', description: 'מזהה השליחות' })
  @ApiParam({ name: 'packageId', description: 'מזהה האריזה' })
  @ApiOperation({
    summary: 'סימון אריזה כהועמסה',
    description: 'מוודא שהאריזה שייכת לשליחות ולעצירה הנוכחית. סריקה חוזרת לא מעמיסה פעמיים.',
  })
  loadPackage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('packageId', ParseUUIDPipe) packageId: string,
    @ZodBody(missionActionSchema, 'MissionAction') body: ScanActionInput,
  ) {
    return this.execution.loadPackage(user, id, packageId, body);
  }

  @Post(':id/depart')
  @HttpCode(200)
  @ApiParam({ name: 'id', description: 'מזהה השליחות' })
  @ApiOperation({
    summary: 'יציאה לדרך',
    description: 'דורש שכל האריזות הועמסו. מרגע זה תכולת האריזות נעולה.',
  })
  depart(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.execution.depart(user, id);
  }

  @Post(':id/start-unloading')
  @HttpCode(200)
  @ApiParam({ name: 'id', description: 'מזהה השליחות' })
  @ApiOperation({ summary: 'תחילת פריקה בקריית התקשוב' })
  startUnloading(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.execution.startUnloading(user, id);
  }

  @Post(':id/packages/:packageId/unload')
  @HttpCode(200)
  @ApiParam({ name: 'id', description: 'מזהה השליחות' })
  @ApiParam({ name: 'packageId', description: 'מזהה האריזה' })
  @ApiOperation({ summary: 'פריקה וקליטה של אריזה' })
  unloadPackage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('packageId', ParseUUIDPipe) packageId: string,
    @ZodBody(missionActionSchema, 'MissionAction') body: ScanActionInput,
  ) {
    return this.execution.unloadPackage(user, id, packageId, body);
  }

  @Post(':id/complete')
  @HttpCode(200)
  @ApiParam({ name: 'id', description: 'מזהה השליחות' })
  @ApiOperation({ summary: 'סיום שליחות', description: 'דורש שכל האריזות נקלטו.' })
  complete(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.execution.complete(user, id);
  }

  // ---------- בקשות הצטרפות ----------

  @Post(':id/join-requests')
  @Roles(UserRole.LOGISTICS_SOLDIER)
  @ApiParam({ name: 'id', description: 'מזהה השליחות' })
  @ApiOperation({
    summary: 'בקשה להוספת איסוף',
    description: 'חייל מבקש לצרף אריזות מוכנות מהבסיס שלו לשליחות מתוכננת.',
  })
  createJoinRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @ZodBody(createJoinRequestSchema, 'CreateJoinRequest') body: CreateJoinRequestInput,
  ) {
    return this.joinRequests.create(user, id, body);
  }
}

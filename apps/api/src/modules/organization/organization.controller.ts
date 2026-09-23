import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  basesQuerySchema,
  floorMapsQuerySchema,
  roomMapSearchQuerySchema,
  roomsQuerySchema,
  teamsQuerySchema,
  unitsQuerySchema,
} from '@south/shared';
import { z } from 'zod';
import { ZodQuery } from '../../common/validation/zod.decorators';
import { CurrentUser } from '../auth/decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { FloorMapService } from './floor-map.service';
import { OrganizationService } from './organization.service';

@ApiTags('Reference Data')
@Controller()
export class OrganizationController {
  constructor(
    private readonly organization: OrganizationService,
    private readonly floorMaps: FloorMapService,
  ) {}

  @Get('bases')
  @ApiOperation({ summary: 'בסיסים', description: 'רשימת הבסיסים, כולל בסיס היעד.' })
  listBases(@ZodQuery(basesQuerySchema, 'BasesQuery') query: z.infer<typeof basesQuerySchema>) {
    return this.organization.listBases(query);
  }

  @Get('units')
  @ApiOperation({ summary: 'יחידות ומדורים' })
  listUnits(@ZodQuery(unitsQuerySchema, 'UnitsQuery') query: z.infer<typeof unitsQuerySchema>) {
    return this.organization.listUnits(query.baseId);
  }

  @Get('teams')
  @ApiOperation({
    summary: 'צוותים',
    description: 'ראש צוות מקבל רק את הצוותים שבתחום ההרשאה שלו.',
  })
  listTeams(
    @CurrentUser() user: AuthenticatedUser,
    @ZodQuery(teamsQuerySchema, 'TeamsQuery') query: z.infer<typeof teamsQuerySchema>,
  ) {
    return this.organization.listTeams(user, query);
  }

  @Get('rooms')
  @ApiOperation({ summary: 'חדרים', description: 'חדרי מקור וחדרי יעד עם Pagination וסינון.' })
  listRooms(
    @CurrentUser() user: AuthenticatedUser,
    @ZodQuery(roomsQuerySchema, 'RoomsQuery') query: z.infer<typeof roomsQuerySchema>,
  ) {
    return this.organization.listRooms(user, query);
  }

  @Get('rooms/:id')
  @ApiParam({ name: 'id', description: 'מזהה החדר' })
  @ApiOperation({ summary: 'פרטי חדר' })
  getRoom(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) roomId: string) {
    return this.organization.getRoom(user, roomId);
  }

  @Get('rooms/:id/inventory')
  @ApiParam({ name: 'id', description: 'מזהה החדר' })
  @ApiOperation({
    summary: 'מלאי החדר',
    description: 'ציוד כמותי לפי מק״ט וכמות, ומחשבים ומסכים לפי מזהה ובעלים.',
  })
  roomInventory(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) roomId: string) {
    return this.organization.roomInventory(user, roomId);
  }

  @Get('rooms/:id/panel')
  @ApiParam({ name: 'id', description: 'מזהה החדר' })
  @ApiOperation({
    summary: 'פאנל חדר במפה',
    description: 'כל המידע שמוצג בלחיצה על חדר במפה: מלאי, משימות פעילות ואריזות.',
  })
  roomPanel(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) roomId: string) {
    return this.floorMaps.roomPanel(user, roomId);
  }

  @Get('floor-maps')
  @ApiOperation({ summary: 'מפות קומה', description: 'רשימת הקומות של בניין היעד.' })
  listFloorMaps(
    @CurrentUser() user: AuthenticatedUser,
    @ZodQuery(floorMapsQuerySchema, 'FloorMapsQuery') query: z.infer<typeof floorMapsQuerySchema>,
  ) {
    return this.floorMaps.listFloorMaps(user, query);
  }

  @Get('floor-maps/search')
  @ApiOperation({
    summary: 'חיפוש במפה',
    description: 'חיפוש לפי מספר חדר, צוות, בעלים, מזהה פריט או מק״ט.',
  })
  searchFloorMaps(
    @CurrentUser() user: AuthenticatedUser,
    @ZodQuery(roomMapSearchQuerySchema, 'RoomMapSearchQuery')
    query: z.infer<typeof roomMapSearchQuerySchema>,
  ) {
    return this.floorMaps.searchRoomMap(user, query);
  }

  @Get('floor-maps/:id')
  @ApiParam({ name: 'id', description: 'מזהה מפת הקומה' })
  @ApiOperation({
    summary: 'מפת קומה',
    description: 'צורות החדרים והמסדרון, עם סיכום ציוד ומצב עדכני לכל חדר.',
  })
  floorMap(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) floorMapId: string) {
    return this.floorMaps.floorMapDetails(user, floorMapId);
  }

  @Get('floor-maps/:id/rooms')
  @ApiParam({ name: 'id', description: 'מזהה מפת הקומה' })
  @ApiOperation({ summary: 'חדרי הקומה' })
  async floorMapRooms(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) floorMapId: string) {
    const details = await this.floorMaps.floorMapDetails(user, floorMapId);
    return details.rooms;
  }
}

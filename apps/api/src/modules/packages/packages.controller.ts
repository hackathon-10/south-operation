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
import { Throttle } from '@nestjs/throttler';
import {
  AddPackageAssetInput,
  AddPackageBulkLineInput,
  PackagesQuery,
  ScanActionInput,
  UpdatePackageInput,
  addPackageAssetSchema,
  addPackageBulkLineSchema,
  packagesQuerySchema,
  publicTokenSchema,
  reopenPackageSchema,
  scanActionSchema,
  updatePackageBulkLineSchema,
  updatePackageSchema,
} from '@south/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/validation/zod.pipe';
import { ZodBody, ZodQuery } from '../../common/validation/zod.decorators';
import { CurrentUser } from '../auth/decorators';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PackagesService } from './packages.service';

@ApiTags('Packages')
@Controller()
export class PackagesController {
  constructor(private readonly packages: PackagesService) {}

  @Get('packages')
  @ApiOperation({
    summary: 'רשימת אריזות',
    description: 'מסוננת אוטומטית לפי תחום ההרשאה של המשתמש.',
  })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @ZodQuery(packagesQuerySchema, 'PackagesQuery') query: PackagesQuery,
  ) {
    return this.packages.list(user, query);
  }

  @Get('packages/:id')
  @ApiParam({ name: 'id', description: 'מזהה האריזה' })
  @ApiOperation({ summary: 'פרטי אריזה', description: 'תכולה מלאה, ציר זמן והרשאות פעולה.' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.packages.get(user, id);
  }

  @Get('packages/:id/label')
  @ApiParam({ name: 'id', description: 'מזהה האריזה' })
  @ApiOperation({
    summary: 'תווית להדפסה',
    description: 'מחזיר את נתוני התווית ואת ה-URL ל-QR. ה-QR מכיל Token אקראי בלבד.',
  })
  label(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.packages.label(user, id);
  }

  /**
   * NoCyberHere: RATE_LIMITING
   * Threat: ניסיון לנחש Tokens של אריזות בסריקות חוזרות
   * Reason: הגבלת קצב על נתיב הסריקה, בנוסף ל-Token אקראי באורך 32 בתים.
   */
  @Throttle({ scan: { limit: 60, ttl: 60_000 } })
  @Get('scan/packages/:publicToken')
  @ApiParam({ name: 'publicToken', description: 'ה-Token מתוך ה-QR' })
  @ApiOperation({
    summary: 'סריקת QR של אריזה',
    description:
      'דורש התחברות והרשאה. מחזיר את פרטי האריזה ואת הפעולה המומלצת לפי הסטטוס והתפקיד.',
  })
  scan(
    @CurrentUser() user: AuthenticatedUser,
    @Param('publicToken', new ZodValidationPipe(publicTokenSchema)) publicToken: string,
  ) {
    return this.packages.scanByToken(user, publicToken);
  }

  @Patch('packages/:id')
  @ApiParam({ name: 'id', description: 'מזהה האריזה' })
  @ApiOperation({ summary: 'עדכון אריזה', description: 'סוג אריזה והערות, כל עוד האריזה פתוחה.' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @ZodBody(updatePackageSchema, 'UpdatePackage') body: UpdatePackageInput,
  ) {
    return this.packages.update(user, id, body);
  }

  @Post('packages/:id/assets')
  @ApiParam({ name: 'id', description: 'מזהה האריזה' })
  @ApiOperation({
    summary: 'הוספת מחשב או מסך',
    description: 'לפי מזהה פנימי או לפי המזהה שעל המדבקה. פריט יכול להיות באריזה אחת בלבד.',
  })
  addAsset(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @ZodBody(addPackageAssetSchema, 'AddPackageAsset', { assetTag: 'LT-00123' })
    body: AddPackageAssetInput,
  ) {
    return this.packages.addAsset(user, id, body);
  }

  @Delete('packages/:id/assets/:assetId')
  @ApiParam({ name: 'id', description: 'מזהה האריזה' })
  @ApiParam({ name: 'assetId', description: 'מזהה הפריט' })
  @ApiOperation({ summary: 'הסרת מחשב או מסך מהאריזה' })
  removeAsset(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('assetId', ParseUUIDPipe) assetId: string,
  ) {
    return this.packages.removeAsset(user, id, assetId);
  }

  @Post('packages/:id/bulk-lines')
  @ApiParam({ name: 'id', description: 'מזהה האריזה' })
  @ApiOperation({
    summary: 'הוספת ציוד כמותי',
    description: 'עד הכמות שנותרה במשימה. הכמות עוברת משוריין לארוז באותה transaction.',
  })
  addBulkLine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @ZodBody(addPackageBulkLineSchema, 'AddPackageBulkLine', {
      productCatalogItemId: '00000000-0000-0000-0000-000000000000',
      quantity: 4,
    })
    body: AddPackageBulkLineInput,
  ) {
    return this.packages.addBulkLine(user, id, body);
  }

  @Patch('packages/:id/bulk-lines/:lineId')
  @ApiParam({ name: 'id', description: 'מזהה האריזה' })
  @ApiParam({ name: 'lineId', description: 'מזהה שורת התכולה' })
  @ApiOperation({ summary: 'עדכון כמות בשורת תכולה' })
  updateBulkLine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @ZodBody(updatePackageBulkLineSchema, 'UpdatePackageBulkLine', { quantity: 3 })
    body: z.infer<typeof updatePackageBulkLineSchema>,
  ) {
    return this.packages.updateBulkLine(user, id, lineId, body.quantity);
  }

  @Delete('packages/:id/bulk-lines/:lineId')
  @ApiParam({ name: 'id', description: 'מזהה האריזה' })
  @ApiParam({ name: 'lineId', description: 'מזהה שורת התכולה' })
  @ApiOperation({ summary: 'הסרת שורת תכולה' })
  removeBulkLine(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
  ) {
    return this.packages.removeBulkLine(user, id, lineId);
  }

  @Post('packages/:id/seal')
  @HttpCode(200)
  @ApiParam({ name: 'id', description: 'מזהה האריזה' })
  @ApiOperation({
    summary: 'סגירת אריזה',
    description: 'בודק תקינות ומעביר ל"סגורה" ואז ל"מוכנה לשילוח", עם שני אירועים בציר הזמן.',
  })
  seal(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.packages.seal(user, id);
  }

  @Post('packages/:id/reopen')
  @HttpCode(200)
  @ApiParam({ name: 'id', description: 'מזהה האריזה' })
  @ApiOperation({
    summary: 'פתיחת אריזה מחדש',
    description: 'מותרת כל עוד השליחות לא יצאה לדרך. לאחר היציאה מוחזר 409.',
  })
  reopen(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(reopenPackageSchema)) body: z.infer<typeof reopenPackageSchema>,
  ) {
    return this.packages.reopen(user, id, body.reason);
  }

  @Post('packages/:id/receive')
  @HttpCode(200)
  @ApiParam({ name: 'id', description: 'מזהה האריזה' })
  @ApiOperation({
    summary: 'קליטה בקריית התקשוב',
    description: 'תומך ב-idempotencyKey כדי שסריקה חוזרת לא תיצור קליטה כפולה.',
  })
  receive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @ZodBody(scanActionSchema, 'ScanAction') body: ScanActionInput,
  ) {
    return this.packages.receive(user, id, body);
  }

  @Post('packages/:id/deliver')
  @HttpCode(200)
  @ApiParam({ name: 'id', description: 'מזהה האריזה' })
  @ApiOperation({
    summary: 'פיזור לחדר היעד',
    description: 'מעדכן את מיקום הפריטים ואת מלאי חדר היעד באותה transaction.',
  })
  deliver(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @ZodBody(scanActionSchema, 'ScanAction') body: ScanActionInput,
  ) {
    return this.packages.deliver(user, id, body);
  }
}

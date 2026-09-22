import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { assetsQuerySchema, catalogQuerySchema } from '@south/shared';
import { z } from 'zod';
import { ZodQuery } from '../../common/validation/zod.decorators';
import { CatalogService } from './catalog.service';

@ApiTags('Catalog')
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('catalog/items')
  @ApiOperation({
    summary: 'קטלוג מוצרים',
    description: 'סוגי מוצרים ומק״טים. SERIALIZED = מחשב או מסך, BULK = ציוד כמותי.',
  })
  listItems(
    @ZodQuery(catalogQuerySchema, 'CatalogQuery') query: z.infer<typeof catalogQuerySchema>,
  ) {
    return this.catalog.listItems(query);
  }

  @Get('assets')
  @ApiOperation({
    summary: 'מחשבים ומסכים',
    description:
      'רשימת פריטים ייחודיים. חיפוש לפי המזהה שעל המדבקה או לפי שם הבעלים. ' +
      'לפריטים אלה אין QR - רק מדבקת ID טקסטואלית.',
  })
  listAssets(
    @ZodQuery(assetsQuerySchema, 'AssetsQuery') query: z.infer<typeof assetsQuerySchema>,
  ) {
    return this.catalog.listAssets(query);
  }
}

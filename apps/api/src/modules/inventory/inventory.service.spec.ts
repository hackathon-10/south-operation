import { Prisma } from '@prisma/client';
import { AppException } from '../../common/errors/app.exception';
import { InventoryService } from './inventory.service';

/**
 * העדכונים במלאי הם עדכונים אטומיים מותנים.
 * הבדיקות כאן מוודאות שכאשר התנאי אינו מתקיים (0 שורות עודכנו),
 * הפעולה נכשלת בשגיאה עסקית ולא משאירה מצב שגוי.
 */
function fakeTx(executeResult: number) {
  return {
    $executeRaw: jest.fn().mockResolvedValue(executeResult),
    roomInventory: { upsert: jest.fn().mockResolvedValue({}) },
    assetInstance: {
      updateMany: jest.fn().mockResolvedValue({ count: executeResult }),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    packageAsset: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as Prisma.TransactionClient;
}

describe('InventoryService', () => {
  const service = new InventoryService();

  it('שריון מצליח כאשר יש מלאי זמין', async () => {
    await expect(service.reserveBulk(fakeTx(1), 'room', 'product', 5)).resolves.toBeUndefined();
  });

  it('שריון נכשל כאשר אין מלאי זמין', async () => {
    await expect(service.reserveBulk(fakeTx(0), 'room', 'product', 5)).rejects.toThrow(
      AppException,
    );
  });

  it('אי אפשר לשריין כמות אפס או שלילית', async () => {
    await expect(service.reserveBulk(fakeTx(1), 'room', 'product', 0)).rejects.toThrow(
      AppException,
    );
    await expect(service.reserveBulk(fakeTx(1), 'room', 'product', -3)).rejects.toThrow(
      AppException,
    );
  });

  it('מעבר משוריין לארוז נכשל אם אין מספיק משוריין', async () => {
    await expect(
      service.moveReservedToPacked(fakeTx(0), 'room', 'product', 2),
    ).rejects.toThrow(AppException);
  });

  it('החזרת ארוז לשריון נכשלת אם אין מספיק ארוז', async () => {
    await expect(
      service.movePackedToReserved(fakeTx(0), 'room', 'product', 2),
    ).rejects.toThrow(AppException);
  });

  it('פיזור מוריד מחדר המקור ומוסיף לחדר היעד', async () => {
    const tx = fakeTx(1);
    await service.deliverBulkToDestination(tx, {
      sourceRoomId: 'source',
      destinationRoomId: 'destination',
      productCatalogItemId: 'product',
      quantity: 4,
    });

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.roomInventory.upsert).toHaveBeenCalledTimes(1);
  });

  it('פיזור נכשל אם הכמות הארוזה אינה מספיקה', async () => {
    await expect(
      service.deliverBulkToDestination(fakeTx(0), {
        sourceRoomId: 'source',
        destinationRoomId: 'destination',
        productCatalogItemId: 'product',
        quantity: 4,
      }),
    ).rejects.toThrow(AppException);
  });

  it('שריון פריט ייחודי נכשל כשהפריט אינו זמין', async () => {
    await expect(service.reserveAsset(fakeTx(0), 'asset', 'room', 'task')).rejects.toThrow(
      AppException,
    );
  });

  it('סימון פריט כארוז נכשל אם הוא כבר נארז', async () => {
    await expect(service.markAssetPacked(fakeTx(0), 'asset', 'task')).rejects.toThrow(
      AppException,
    );
  });
});

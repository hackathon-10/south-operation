import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AssetStatus } from '@south/shared';
import { AppException } from '../../common/errors/app.exception';

/**
 * שירות המלאי והשריונים - הליבה העסקית של §8.13.
 *
 * כל הפעולות מקבלות transaction client ומבוצעות כעדכון אטומי מותנה,
 * כך ששתי בקשות מקבילות לא יוכלו לשריין או לארוז את אותו פריט פעמיים.
 *
 * NoCyberHere: PARAMETERIZED_DATABASE_ACCESS
 * Threat: SQL Injection דרך ערכים מהמשתמש בשאילתות המלאי
 * Reason: השאילתות הגולמיות נכתבות כ-tagged templates של Prisma, כך שכל ערך עובר כפרמטר.
 */
@Injectable()
export class InventoryService {
  /**
   * שריון כמות ציוד כמותי בחדר.
   * התנאי `mapped - reserved - packed >= quantity` נבדק בתוך ה-UPDATE עצמו,
   * ולכן אין חלון מרוץ בין קריאה לכתיבה ואין אפשרות לערך שלילי.
   */
  async reserveBulk(
    tx: Prisma.TransactionClient,
    roomId: string,
    productCatalogItemId: string,
    quantity: number,
  ): Promise<void> {
    if (quantity <= 0) throw new AppException('QUANTITY_MUST_BE_POSITIVE');

    const updated = await tx.$executeRaw`
      UPDATE "RoomInventory"
      SET "reservedQuantity" = "reservedQuantity" + ${quantity}
      WHERE "roomId" = ${roomId}::uuid
        AND "productCatalogItemId" = ${productCatalogItemId}::uuid
        AND "mappedQuantity" - "reservedQuantity" - "packedQuantity" >= ${quantity}
    `;

    if (updated !== 1) throw new AppException('INSUFFICIENT_INVENTORY');
  }

  /** שחרור שריון (ביטול משימה או הקטנת כמות). */
  async releaseBulkReservation(
    tx: Prisma.TransactionClient,
    roomId: string,
    productCatalogItemId: string,
    quantity: number,
  ): Promise<void> {
    if (quantity <= 0) return;

    const updated = await tx.$executeRaw`
      UPDATE "RoomInventory"
      SET "reservedQuantity" = "reservedQuantity" - ${quantity}
      WHERE "roomId" = ${roomId}::uuid
        AND "productCatalogItemId" = ${productCatalogItemId}::uuid
        AND "reservedQuantity" >= ${quantity}
    `;

    if (updated !== 1) throw new AppException('INSUFFICIENT_INVENTORY');
  }

  /** העברת כמות משוריינת לארוזה - קורה בהוספת ציוד לאריזה. */
  async moveReservedToPacked(
    tx: Prisma.TransactionClient,
    roomId: string,
    productCatalogItemId: string,
    quantity: number,
  ): Promise<void> {
    if (quantity <= 0) throw new AppException('QUANTITY_MUST_BE_POSITIVE');

    const updated = await tx.$executeRaw`
      UPDATE "RoomInventory"
      SET "reservedQuantity" = "reservedQuantity" - ${quantity},
          "packedQuantity" = "packedQuantity" + ${quantity}
      WHERE "roomId" = ${roomId}::uuid
        AND "productCatalogItemId" = ${productCatalogItemId}::uuid
        AND "reservedQuantity" >= ${quantity}
    `;

    if (updated !== 1) throw new AppException('INSUFFICIENT_INVENTORY');
  }

  /** החזרת כמות ארוזה לשריון - קורה בהסרת ציוד מאריזה לפני יציאה. */
  async movePackedToReserved(
    tx: Prisma.TransactionClient,
    roomId: string,
    productCatalogItemId: string,
    quantity: number,
  ): Promise<void> {
    if (quantity <= 0) return;

    const updated = await tx.$executeRaw`
      UPDATE "RoomInventory"
      SET "packedQuantity" = "packedQuantity" - ${quantity},
          "reservedQuantity" = "reservedQuantity" + ${quantity}
      WHERE "roomId" = ${roomId}::uuid
        AND "productCatalogItemId" = ${productCatalogItemId}::uuid
        AND "packedQuantity" >= ${quantity}
    `;

    if (updated !== 1) throw new AppException('INSUFFICIENT_INVENTORY');
  }

  /**
   * פיזור לחדר היעד: הציוד יוצא ממלאי חדר המקור ונכנס למלאי חדר היעד.
   * שתי הפעולות מתבצעות באותה transaction.
   */
  async deliverBulkToDestination(
    tx: Prisma.TransactionClient,
    params: {
      sourceRoomId: string;
      destinationRoomId: string;
      productCatalogItemId: string;
      quantity: number;
    },
  ): Promise<void> {
    const { sourceRoomId, destinationRoomId, productCatalogItemId, quantity } = params;
    if (quantity <= 0) return;

    const removed = await tx.$executeRaw`
      UPDATE "RoomInventory"
      SET "packedQuantity" = "packedQuantity" - ${quantity},
          "mappedQuantity" = "mappedQuantity" - ${quantity}
      WHERE "roomId" = ${sourceRoomId}::uuid
        AND "productCatalogItemId" = ${productCatalogItemId}::uuid
        AND "packedQuantity" >= ${quantity}
        AND "mappedQuantity" >= ${quantity}
    `;
    if (removed !== 1) throw new AppException('INSUFFICIENT_INVENTORY');

    await tx.roomInventory.upsert({
      where: {
        roomId_productCatalogItemId: { roomId: destinationRoomId, productCatalogItemId },
      },
      create: {
        roomId: destinationRoomId,
        productCatalogItemId,
        mappedQuantity: quantity,
        deliveredQuantity: quantity,
      },
      update: {
        mappedQuantity: { increment: quantity },
        deliveredQuantity: { increment: quantity },
      },
    });
  }

  /**
   * שריון פריט ייחודי (מחשב/מסך) למשימה.
   * העדכון מותנה בכך שהפריט זמין ונמצא בחדר המקור - לכן אין מרוץ בין שתי משימות.
   */
  async reserveAsset(
    tx: Prisma.TransactionClient,
    assetInstanceId: string,
    sourceRoomId: string,
    taskId: string,
  ): Promise<void> {
    const updated = await tx.assetInstance.updateMany({
      where: {
        id: assetInstanceId,
        status: AssetStatus.AVAILABLE,
        currentRoomId: sourceRoomId,
        reservedForTaskId: null,
      },
      data: { status: AssetStatus.RESERVED_FOR_TASK, reservedForTaskId: taskId },
    });

    if (updated.count !== 1) {
      const asset = await tx.assetInstance.findUnique({
        where: { id: assetInstanceId },
        select: { id: true, currentRoomId: true, status: true },
      });
      if (!asset) throw new AppException('ASSET_NOT_FOUND');
      if (asset.currentRoomId !== sourceRoomId) throw new AppException('ASSET_WRONG_ROOM');
      throw new AppException('ASSET_NOT_AVAILABLE');
    }
  }

  /** שחרור פריטים ייחודיים שטרם נארזו (ביטול משימה). */
  async releaseUnpackedAssets(tx: Prisma.TransactionClient, taskId: string): Promise<number> {
    const result = await tx.assetInstance.updateMany({
      where: { reservedForTaskId: taskId, status: AssetStatus.RESERVED_FOR_TASK },
      data: { status: AssetStatus.AVAILABLE, reservedForTaskId: null },
    });
    return result.count;
  }

  async markAssetPacked(tx: Prisma.TransactionClient, assetInstanceId: string, taskId: string) {
    const updated = await tx.assetInstance.updateMany({
      where: {
        id: assetInstanceId,
        status: AssetStatus.RESERVED_FOR_TASK,
        reservedForTaskId: taskId,
      },
      data: { status: AssetStatus.PACKED },
    });
    if (updated.count !== 1) throw new AppException('ASSET_ALREADY_PACKED');
  }

  async markAssetBackToReserved(tx: Prisma.TransactionClient, assetInstanceId: string) {
    await tx.assetInstance.updateMany({
      where: { id: assetInstanceId, status: AssetStatus.PACKED },
      data: { status: AssetStatus.RESERVED_FOR_TASK },
    });
  }

  async setAssetsStatusForPackage(
    tx: Prisma.TransactionClient,
    packageId: string,
    status: AssetStatus,
    extra?: { currentRoomId?: string },
  ): Promise<void> {
    const packageAssets = await tx.packageAsset.findMany({
      where: { packageId },
      select: { assetInstanceId: true },
    });
    if (packageAssets.length === 0) return;

    await tx.assetInstance.updateMany({
      where: { id: { in: packageAssets.map((item) => item.assetInstanceId) } },
      data: {
        status,
        ...(extra?.currentRoomId ? { currentRoomId: extra.currentRoomId } : {}),
        ...(status === AssetStatus.DELIVERED ? { reservedForTaskId: null } : {}),
      },
    });
  }
}

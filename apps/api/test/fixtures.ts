import { hash } from '@node-rs/argon2';
import type { PrismaClient } from '@prisma/client';

export const TEST_PASSWORD = 'Demo!2345';

export interface Fixtures {
  hubBaseId: string;
  gdnBaseId: string;
  tzrBaseId: string;
  teamDevId: string;
  teamOtherId: string;
  commanderId: string;
  soldierGdnId: string;
  soldierTzrId: string;
  soldierHubId: string;
  teamLeadId: string;
  otherTeamLeadId: string;
  sourceRoomGdnId: string;
  sourceRoomTzrId: string;
  destinationRoomId: string;
  laptopProductId: string;
  monitorProductId: string;
  mouseProductId: string;
  laptopAssetId: string;
  laptopAssetTag: string;
  monitorAssetId: string;
  tzrAssetId: string;
}

/**
 * נתוני בסיס לבדיקות האינטגרציה.
 * מייצר מבנה ארגוני מינימלי אך מלא: שני בסיסי מקור, בסיס יעד, צוותים,
 * משתמשים לכל תפקיד, קטלוג, חדרים, מלאי ופריטים ייחודיים.
 */
export async function seedFixtures(prisma: PrismaClient): Promise<Fixtures> {
  const passwordHash = await hash(TEST_PASSWORD);

  const hub = await prisma.base.create({
    data: {
      code: 'KT',
      name: 'קריית התקשוב',
      addressText: 'דמה',
      latitude: 31.25,
      longitude: 34.79,
      isDestinationHub: true,
    },
  });
  const gdn = await prisma.base.create({
    data: {
      code: 'GDN',
      name: 'גדעונים',
      addressText: 'דמה',
      latitude: 32.02,
      longitude: 34.85,
      isDestinationHub: false,
    },
  });
  const tzr = await prisma.base.create({
    data: {
      code: 'TZR',
      name: 'צריפין',
      addressText: 'דמה',
      latitude: 31.95,
      longitude: 34.83,
      isDestinationHub: false,
    },
  });

  const hubUnit = await prisma.organizationalUnit.create({
    data: { code: 'KT-HQ', name: 'מטה', baseId: hub.id, type: 'UNIT' },
  });
  const gdnUnit = await prisma.organizationalUnit.create({
    data: { code: 'GDN-T', name: 'ענף טכנולוגיות', baseId: gdn.id, type: 'BRANCH' },
  });

  const teamDev = await prisma.team.create({
    data: { code: 'DEV-A', name: 'צוות פיתוח א׳', unitId: gdnUnit.id },
  });
  const teamOther = await prisma.team.create({
    data: { code: 'LAB', name: 'צוות מעבדה', unitId: gdnUnit.id },
  });

  const commander = await prisma.user.create({
    data: {
      identityNumber: '1000001',
      fullName: 'מפקדת לוגיסטיקה',
      email: 'commander@test.demo',
      passwordHash,
      role: 'LOGISTICS_COMMANDER',
      baseId: hub.id,
    },
  });
  const soldierGdn = await prisma.user.create({
    data: {
      identityNumber: '1000002',
      fullName: 'חיילת גדעונים',
      email: 'soldier.gdn@test.demo',
      passwordHash,
      role: 'LOGISTICS_SOLDIER',
      baseId: gdn.id,
    },
  });
  const soldierTzr = await prisma.user.create({
    data: {
      identityNumber: '1000003',
      fullName: 'חייל צריפין',
      email: 'soldier.tzr@test.demo',
      passwordHash,
      role: 'LOGISTICS_SOLDIER',
      baseId: tzr.id,
    },
  });
  const soldierHub = await prisma.user.create({
    data: {
      identityNumber: '1000004',
      fullName: 'חייל קליטה',
      email: 'soldier.hub@test.demo',
      passwordHash,
      role: 'LOGISTICS_SOLDIER',
      baseId: hub.id,
    },
  });
  const teamLead = await prisma.user.create({
    data: {
      identityNumber: '1000005',
      fullName: 'ראש צוות פיתוח',
      email: 'lead.dev@test.demo',
      passwordHash,
      role: 'TEAM_LEAD',
      baseId: gdn.id,
      teamId: teamDev.id,
    },
  });
  const otherTeamLead = await prisma.user.create({
    data: {
      identityNumber: '1000006',
      fullName: 'ראש צוות מעבדה',
      email: 'lead.lab@test.demo',
      passwordHash,
      role: 'TEAM_LEAD',
      baseId: gdn.id,
      teamId: teamOther.id,
    },
  });

  await prisma.team.update({ where: { id: teamDev.id }, data: { leadUserId: teamLead.id } });
  await prisma.team.update({
    where: { id: teamOther.id },
    data: { leadUserId: otherTeamLead.id },
  });

  const laptop = await prisma.productCatalogItem.create({
    data: { sku: 'LT-14', name: 'מחשב נייד', category: 'מחשבים', trackingMode: 'SERIALIZED' },
  });
  const monitor = await prisma.productCatalogItem.create({
    data: { sku: 'MN-24', name: 'מסך 24', category: 'מסכים', trackingMode: 'SERIALIZED' },
  });
  const mouse = await prisma.productCatalogItem.create({
    data: { sku: 'ACC-MOUSE', name: 'עכבר', category: 'ציוד היקפי', trackingMode: 'BULK' },
  });

  const floorMap = await prisma.floorMap.create({
    data: {
      baseId: hub.id,
      building: 'בניין תקשוב מרכזי',
      floorNumber: 2,
      displayName: 'קומה 2',
    },
  });

  const sourceRoomGdn = await prisma.room.create({
    data: {
      baseId: gdn.id,
      unitId: gdnUnit.id,
      teamId: teamDev.id,
      building: 'בניין 7',
      floor: '1',
      roomNumber: '12',
      displayName: 'חדר פיתוח א׳',
    },
  });
  const sourceRoomTzr = await prisma.room.create({
    data: {
      baseId: tzr.id,
      teamId: teamOther.id,
      building: 'בניין 3',
      floor: '1',
      roomNumber: '8',
      displayName: 'חדר NOC',
    },
  });
  const destinationRoom = await prisma.room.create({
    data: {
      baseId: hub.id,
      unitId: hubUnit.id,
      teamId: teamDev.id,
      building: 'בניין תקשוב מרכזי',
      floor: '2',
      roomNumber: '201',
      displayName: 'צוות פיתוח א׳',
      floorMapId: floorMap.id,
    },
  });

  await prisma.roomMapShape.create({
    data: {
      floorMapId: floorMap.id,
      roomId: destinationRoom.id,
      x: 40,
      y: 40,
      width: 200,
      height: 170,
      doorSide: 'SOUTH',
    },
  });

  await prisma.roomInventory.create({
    data: {
      roomId: sourceRoomGdn.id,
      productCatalogItemId: mouse.id,
      mappedQuantity: 10,
    },
  });
  await prisma.roomInventory.create({
    data: {
      roomId: sourceRoomTzr.id,
      productCatalogItemId: mouse.id,
      mappedQuantity: 6,
    },
  });

  const laptopAsset = await prisma.assetInstance.create({
    data: {
      assetTag: 'LT-0001',
      productCatalogItemId: laptop.id,
      ownerName: 'רועי לוי',
      ownerIdentityNumber: '2222222',
      currentRoomId: sourceRoomGdn.id,
      status: 'AVAILABLE',
    },
  });
  const monitorAsset = await prisma.assetInstance.create({
    data: {
      assetTag: 'MN-0001',
      productCatalogItemId: monitor.id,
      ownerName: 'מאיה כהן',
      currentRoomId: sourceRoomGdn.id,
      status: 'AVAILABLE',
    },
  });
  const tzrAsset = await prisma.assetInstance.create({
    data: {
      assetTag: 'LT-0099',
      productCatalogItemId: laptop.id,
      ownerName: 'עידן שגב',
      currentRoomId: sourceRoomTzr.id,
      status: 'AVAILABLE',
    },
  });

  return {
    hubBaseId: hub.id,
    gdnBaseId: gdn.id,
    tzrBaseId: tzr.id,
    teamDevId: teamDev.id,
    teamOtherId: teamOther.id,
    commanderId: commander.id,
    soldierGdnId: soldierGdn.id,
    soldierTzrId: soldierTzr.id,
    soldierHubId: soldierHub.id,
    teamLeadId: teamLead.id,
    otherTeamLeadId: otherTeamLead.id,
    sourceRoomGdnId: sourceRoomGdn.id,
    sourceRoomTzrId: sourceRoomTzr.id,
    destinationRoomId: destinationRoom.id,
    laptopProductId: laptop.id,
    monitorProductId: monitor.id,
    mouseProductId: mouse.id,
    laptopAssetId: laptopAsset.id,
    laptopAssetTag: laptopAsset.assetTag,
    monitorAssetId: monitorAsset.id,
    tzrAssetId: tzrAsset.id,
  };
}

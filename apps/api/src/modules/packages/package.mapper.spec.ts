import { PackageStatus } from '@south/shared';
import { PackageDetailRow, toPackageDetail } from './package.mapper';

/** שורת אריזה מינימלית לצורך בדיקת ההרשאות והנעילה. */
function row(status: PackageStatus): PackageDetailRow {
  const now = new Date('2026-01-01T10:00:00.000Z');
  return {
    id: 'pkg-1',
    packageNumber: 'PKG-10001',
    publicToken: 'token',
    packingTaskId: 'task-1',
    sourceRoomId: 'room-source',
    destinationRoomId: 'room-destination',
    teamId: 'team-1',
    packageType: 'PROFESSIONAL_BOX',
    status,
    notes: null,
    sealedAt: status === PackageStatus.OPEN ? null : now,
    departedAt: null,
    receivedAt: null,
    deliveredAt: null,
    createdById: 'user-1',
    responsibleUserId: 'user-2',
    createdAt: now,
    updatedAt: now,
    team: { id: 'team-1', name: 'צוות פיתוח א׳' },
    responsibleUser: { id: 'user-2', fullName: 'סרן רועי לוי' },
    task: { id: 'task-1', taskNumber: 'TSK-00101', priority: 'HIGH', assignedSoldierId: 'sol-1' },
    sourceRoom: {
      id: 'room-source',
      displayName: 'חדר פיתוח א׳',
      baseId: 'base-gdn',
      base: { name: 'גדעונים' },
    },
    destinationRoom: {
      id: 'room-destination',
      displayName: 'צוות פיתוח א׳',
      building: 'בניין תקשוב מרכזי',
      floor: '2',
      roomNumber: '201',
      baseId: 'base-hub',
    },
    missionPackage: null,
    createdBy: { id: 'user-1', fullName: 'רס״ל אלה מאיר' },
    assets: [
      {
        id: 'pa-1',
        assetInstanceId: 'asset-1',
        assetTagSnapshot: 'LT-0001',
        productNameSnapshot: 'מחשב נייד 14 אינץ׳',
        ownerNameSnapshot: 'רועי לוי',
        assetInstance: {
          ownerIdentityNumber: '1234567',
          product: { sku: 'LT-EL-14', name: 'מחשב נייד 14 אינץ׳' },
        },
      },
    ],
    bulkLines: [
      {
        id: 'bl-1',
        quantity: 6,
        productCatalogItemId: 'product-1',
        product: { sku: 'ACC-MOUSE', name: 'עכבר אלחוטי', unitOfMeasure: 'יח׳' },
      },
    ],
    statusEvents: [],
  } as unknown as PackageDetailRow;
}

const fullPermissions = { canEditContent: true, canHandleAtHub: true, canPrintLabel: true };

describe('מיפוי אריזה והרשאות פעולה', () => {
  it('מחשב מספר שורות וכמות יחידות כוללת', () => {
    const dto = toPackageDetail(row(PackageStatus.OPEN), fullPermissions);
    expect(dto.itemLineCount).toBe(2);
    expect(dto.totalUnits).toBe(7);
    expect(dto.destination.roomNumber).toBe('201');
  });

  it('אריזה פתוחה ניתנת לעריכה ולסגירה', () => {
    const dto = toPackageDetail(row(PackageStatus.OPEN), fullPermissions);
    expect(dto.isLocked).toBe(false);
    expect(dto.permissions.canEditContent).toBe(true);
    expect(dto.permissions.canSeal).toBe(true);
    expect(dto.permissions.canReopen).toBe(false);
  });

  it('אריזה מוכנה לשילוח ניתנת לפתיחה מחדש אך לא לעריכה ישירה', () => {
    const dto = toPackageDetail(row(PackageStatus.READY_FOR_SHIPMENT), fullPermissions);
    expect(dto.permissions.canEditContent).toBe(false);
    expect(dto.permissions.canReopen).toBe(true);
    expect(dto.permissions.canPrintLabel).toBe(true);
  });

  it('אריזה שיצאה לדרך נעולה לחלוטין', () => {
    const dto = toPackageDetail(row(PackageStatus.IN_TRANSIT), fullPermissions);
    expect(dto.isLocked).toBe(true);
    expect(dto.permissions.canEditContent).toBe(false);
    expect(dto.permissions.canSeal).toBe(false);
    expect(dto.permissions.canReopen).toBe(false);
    expect(dto.permissions.canReceive).toBe(true);
  });

  it('אריזה שנקלטה ממתינה לפיזור בלבד', () => {
    const dto = toPackageDetail(row(PackageStatus.RECEIVED_AT_HUB), fullPermissions);
    expect(dto.permissions.canReceive).toBe(false);
    expect(dto.permissions.canDeliver).toBe(true);
  });

  it('משתמש ללא הרשאת עריכה אינו מקבל פעולות עריכה', () => {
    const dto = toPackageDetail(row(PackageStatus.OPEN), {
      canEditContent: false,
      canHandleAtHub: false,
      canPrintLabel: false,
    });
    expect(dto.permissions.canEditContent).toBe(false);
    expect(dto.permissions.canSeal).toBe(false);
    expect(dto.permissions.canPrintLabel).toBe(false);
    expect(dto.permissions.canDeliver).toBe(false);
  });

  it('תכולת האריזה כוללת מזהה ובעלים למחשבים, ומק״ט וכמות לציוד כמותי', () => {
    const dto = toPackageDetail(row(PackageStatus.DELIVERED_TO_ROOM), fullPermissions);
    expect(dto.assets[0]).toMatchObject({ assetTag: 'LT-0001', ownerName: 'רועי לוי' });
    expect(dto.bulkLines[0]).toMatchObject({ sku: 'ACC-MOUSE', quantity: 6 });
  });
});

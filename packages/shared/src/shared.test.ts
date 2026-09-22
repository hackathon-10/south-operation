import { describe, expect, it } from 'vitest';
import {
  ERROR_CATALOG,
  PACKAGE_STATUSES,
  PACKAGE_STATUS_LABEL,
  PackageStatus,
  PackingTaskStatus,
  MissionStatus,
  buildScanUrl,
  canTransitionMission,
  canTransitionPackage,
  canTransitionTask,
  createMissionSchema,
  createPackingTaskSchema,
  formatFriendlyId,
  humanizeApiError,
  isPackageLocked,
  loginSchema,
  mappingImportRowSchema,
} from './index';

describe('מכונת מצבים - אריזה', () => {
  it('מאפשרת את המסלול המלא מפתיחה ועד הגעה לחדר', () => {
    expect(canTransitionPackage(PackageStatus.OPEN, PackageStatus.SEALED)).toBe(true);
    expect(
      canTransitionPackage(PackageStatus.SEALED, PackageStatus.READY_FOR_SHIPMENT),
    ).toBe(true);
    expect(
      canTransitionPackage(PackageStatus.READY_FOR_SHIPMENT, PackageStatus.ASSIGNED_TO_MISSION),
    ).toBe(true);
    expect(
      canTransitionPackage(PackageStatus.ASSIGNED_TO_MISSION, PackageStatus.IN_TRANSIT),
    ).toBe(true);
    expect(canTransitionPackage(PackageStatus.IN_TRANSIT, PackageStatus.RECEIVED_AT_HUB)).toBe(
      true,
    );
    expect(
      canTransitionPackage(PackageStatus.RECEIVED_AT_HUB, PackageStatus.DELIVERED_TO_ROOM),
    ).toBe(true);
  });

  it('חוסמת מעברים שאינם מוגדרים', () => {
    expect(canTransitionPackage(PackageStatus.OPEN, PackageStatus.IN_TRANSIT)).toBe(false);
    expect(canTransitionPackage(PackageStatus.IN_TRANSIT, PackageStatus.OPEN)).toBe(false);
    expect(
      canTransitionPackage(PackageStatus.DELIVERED_TO_ROOM, PackageStatus.RECEIVED_AT_HUB),
    ).toBe(false);
  });

  it('נועלת אריזה מרגע היציאה לדרך', () => {
    expect(isPackageLocked(PackageStatus.READY_FOR_SHIPMENT)).toBe(false);
    expect(isPackageLocked(PackageStatus.ASSIGNED_TO_MISSION)).toBe(false);
    expect(isPackageLocked(PackageStatus.IN_TRANSIT)).toBe(true);
    expect(isPackageLocked(PackageStatus.RECEIVED_AT_HUB)).toBe(true);
    expect(isPackageLocked(PackageStatus.DELIVERED_TO_ROOM)).toBe(true);
  });

  it('לכל סטטוס אריזה יש תווית בעברית', () => {
    for (const status of PACKAGE_STATUSES) {
      expect(PACKAGE_STATUS_LABEL[status]).toBeTruthy();
    }
  });
});

describe('מכונת מצבים - משימה ושליחות', () => {
  it('משימה עוברת רק במסלולים המותרים', () => {
    expect(canTransitionTask(PackingTaskStatus.ASSIGNED, PackingTaskStatus.IN_PROGRESS)).toBe(
      true,
    );
    expect(canTransitionTask(PackingTaskStatus.IN_PROGRESS, PackingTaskStatus.COMPLETED)).toBe(
      true,
    );
    expect(canTransitionTask(PackingTaskStatus.COMPLETED, PackingTaskStatus.IN_PROGRESS)).toBe(
      false,
    );
    expect(canTransitionTask(PackingTaskStatus.CANCELLED, PackingTaskStatus.IN_PROGRESS)).toBe(
      false,
    );
  });

  it('שליחות אינה יכולה לדלג על העמסה', () => {
    expect(canTransitionMission(MissionStatus.PLANNED, MissionStatus.LOADING)).toBe(true);
    expect(canTransitionMission(MissionStatus.PLANNED, MissionStatus.IN_TRANSIT)).toBe(false);
    expect(canTransitionMission(MissionStatus.IN_TRANSIT, MissionStatus.PLANNED)).toBe(false);
  });
});

describe('סכמות קלט', () => {
  it('דוחה אימייל לא תקין ומקבלת אימייל תקין', () => {
    expect(loginSchema.safeParse({ email: 'not-an-email', password: '12345678' }).success).toBe(
      false,
    );
    const ok = loginSchema.safeParse({ email: 'A@Example.com ', password: 'Demo!2345' });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.email).toBe('a@example.com');
  });

  it('דוחה שדות לא מוכרים (forbidNonWhitelisted)', () => {
    const result = loginSchema.safeParse({
      email: 'a@example.com',
      password: 'Demo!2345',
      role: 'LOGISTICS_COMMANDER',
    });
    expect(result.success).toBe(false);
  });

  it('מחייבת כמות 1 בפריט ייחודי במשימת אריזה', () => {
    const base = {
      sourceRoomId: '11111111-1111-4111-8111-111111111111',
      destinationRoomId: '22222222-2222-4222-8222-222222222222',
      teamId: '33333333-3333-4333-8333-333333333333',
      assignedSoldierId: '44444444-4444-4444-8444-444444444444',
      lines: [
        {
          productCatalogItemId: '55555555-5555-4555-8555-555555555555',
          assetInstanceId: '66666666-6666-4666-8666-666666666666',
          requestedQuantity: 3,
        },
      ],
    };
    expect(createPackingTaskSchema.safeParse(base).success).toBe(false);
    base.lines[0].requestedQuantity = 1;
    expect(createPackingTaskSchema.safeParse(base).success).toBe(true);
  });

  it('מחייבת הנחיות כאשר נדרשת נסיעה מאובטחת', () => {
    const mission = {
      title: 'איסוף מגדעונים',
      plannedDepartureAt: '2026-01-01T08:00:00.000Z',
      packageIds: ['77777777-7777-4777-8777-777777777777'],
      requiresSecuredTransport: true,
    };
    expect(createMissionSchema.safeParse(mission).success).toBe(false);
    expect(
      createMissionSchema.safeParse({ ...mission, securedTransportNotes: 'ליווי לפי נוהל' })
        .success,
    ).toBe(true);
  });

  it('אוכפת את כללי פורמט קובץ המיפוי', () => {
    const serialized = {
      baseCode: 'KT',
      unitCode: 'U1',
      teamCode: 'T1',
      building: 'בניין תקשוב מרכזי',
      floor: '1',
      roomNumber: '101',
      sku: 'SKU-LAPTOP',
      productName: 'מחשב נייד',
      category: 'מחשבים',
      trackingMode: 'SERIALIZED',
      quantity: '1',
      assetTag: 'LT-0001',
      ownerName: 'דמו דמו',
      ownerIdentityNumber: '',
    };
    expect(mappingImportRowSchema.safeParse(serialized).success).toBe(true);
    expect(
      mappingImportRowSchema.safeParse({ ...serialized, assetTag: '', ownerName: '' }).success,
    ).toBe(false);
    expect(
      mappingImportRowSchema.safeParse({
        ...serialized,
        trackingMode: 'BULK',
        assetTag: '',
        ownerName: '',
        quantity: '0',
      }).success,
    ).toBe(false);
  });
});

describe('שגיאות והודעות למשתמש', () => {
  it('לכל שגיאה יש הודעה בעברית ואין בה מספר סטטוס', () => {
    for (const [code, definition] of Object.entries(ERROR_CATALOG)) {
      expect(definition.message.length, code).toBeGreaterThan(3);
      expect(/^\d{3}$/.test(definition.message), code).toBe(false);
      expect(definition.status, code).toBeGreaterThanOrEqual(400);
    }
  });

  it('מתרגמת קוד שגיאה מהשרת להודעה אנושית', () => {
    const result = humanizeApiError({ code: 'PACKAGE_LOCKED', statusCode: 409 });
    expect(result.message).toContain('שליחות');
    const unknown = humanizeApiError({ code: 'SOMETHING_ELSE', statusCode: 500 });
    expect(unknown.message).toBe(ERROR_CATALOG.INTERNAL_ERROR.message);
  });
});

describe('עזרי מזהים ו-QR', () => {
  it('מייצר מזהה ידידותי מרופד', () => {
    expect(formatFriendlyId('PKG-', 425)).toBe('PKG-00425');
    expect(formatFriendlyId('TSK-', 128)).toBe('TSK-00128');
  });

  it('בונה קישור סריקה שמכיל רק את ה-Token', () => {
    const url = buildScanUrl('https://app.example/', 'abcDEF123_-xyz');
    expect(url).toBe('https://app.example/scan/package/abcDEF123_-xyz');
    expect(url).not.toContain('PKG-');
  });
});

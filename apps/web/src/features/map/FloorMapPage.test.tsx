import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FloorMapDetailsDto, RoomPanelDto } from '@south/shared';
import { renderWithProviders } from '../../test/utils';
import { FloorMapPage } from './FloorMapPage';

const floorOne: FloorMapDetailsDto = {
  map: {
    id: 'map-1',
    baseId: 'base-hub',
    building: 'בניין תקשוב מרכזי',
    floorNumber: 1,
    displayName: 'קומה 1 - קליטה ותשתיות',
    canvasWidth: 1000,
    canvasHeight: 600,
    version: 1,
  },
  corridor: { x: 20, y: 250, width: 960, height: 100 },
  rooms: [
    {
      shapeId: 'shape-101',
      roomId: 'room-101',
      roomNumber: '101',
      displayName: 'קבלה לוגיסטית',
      teamId: 'team-1',
      teamName: 'צוות קליטה',
      x: 40,
      y: 40,
      width: 200,
      height: 170,
      doorSide: 'SOUTH',
      zone: 'אגף צפוני',
      totalUnits: 12,
      assetCount: 3,
      activeTaskCount: 1,
      incomingPackageCount: 0,
      arrivedPackageCount: 0,
      state: 'PACKING_IN_PROGRESS',
    },
  ],
};

const floorTwo: FloorMapDetailsDto = {
  ...floorOne,
  map: { ...floorOne.map, id: 'map-2', floorNumber: 2, displayName: 'קומה 2 - פיתוח ומוצר' },
  rooms: [
    {
      ...floorOne.rooms[0],
      shapeId: 'shape-201',
      roomId: 'room-201',
      roomNumber: '201',
      displayName: 'צוות פיתוח א׳',
      totalUnits: 0,
      assetCount: 0,
      activeTaskCount: 0,
      state: 'EMPTY',
    },
  ],
};

const roomPanel: RoomPanelDto = {
  room: {
    id: 'room-101',
    baseId: 'base-hub',
    baseName: 'קריית התקשוב',
    unitId: null,
    teamId: 'team-1',
    teamName: 'צוות קליטה',
    building: 'בניין תקשוב מרכזי',
    floor: '1',
    roomNumber: '101',
    displayName: 'קבלה לוגיסטית',
    floorMapId: 'map-1',
    mappingStatus: 'MAPPED',
    isActive: true,
  },
  teamName: 'צוות קליטה',
  leadUserName: 'סרן רועי לוי',
  bulkLines: [
    {
      productCatalogItemId: 'product-1',
      sku: 'ACC-MOUSE',
      productName: 'עכבר אלחוטי',
      category: 'ציוד היקפי',
      unitOfMeasure: 'יח׳',
      mappedQuantity: 9,
      reservedQuantity: 0,
      packedQuantity: 0,
      deliveredQuantity: 0,
      availableQuantity: 9,
    },
  ],
  assets: [
    {
      id: 'asset-1',
      assetTag: 'LT-0007',
      productCatalogItemId: 'product-2',
      productName: 'מחשב נייד 14 אינץ׳',
      sku: 'LT-EL-14',
      category: 'מחשבים',
      ownerName: 'מאיה כהן',
      ownerIdentityNumber: null,
      currentRoomId: 'room-101',
      currentRoomName: 'קבלה לוגיסטית',
      status: 'AVAILABLE',
      reservedForTaskId: null,
    },
  ],
  activeTasks: [],
  incomingPackages: [],
  arrivedPackages: [],
  state: 'PACKING_IN_PROGRESS',
  totals: { bulkUnits: 9, assetUnits: 1, totalUnits: 10 },
};

const selectedFloorId = { current: 'map-1' };

vi.mock('../../api/queries', () => ({
  useBases: () => ({
    data: [
      {
        id: 'base-hub',
        code: 'KT',
        name: 'קריית התקשוב',
        addressText: '',
        latitude: 31,
        longitude: 34,
        isDestinationHub: true,
      },
    ],
  }),
  useFloorMaps: () => ({
    data: [floorOne.map, floorTwo.map],
  }),
  useFloorMap: (id?: string) => {
    selectedFloorId.current = id ?? 'map-1';
    return {
      data: id === 'map-2' ? floorTwo : floorOne,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };
  },
  useFloorMapSearch: (query: string) => ({
    data:
      query.trim().length >= 2
        ? [
            {
              roomId: 'room-201',
              roomNumber: '201',
              displayName: 'צוות פיתוח א׳',
              floorNumber: 2,
              floorMapId: 'map-2',
              matchedOn: 'OWNER',
              matchedValue: 'מאיה כהן',
            },
          ]
        : [],
  }),
  useRoomPanel: (roomId?: string) => ({
    data: roomId === 'room-101' ? roomPanel : undefined,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

describe('מפת החדרים האינטראקטיבית', () => {
  it('מציגה את הקומה הראשונה עם המסדרון והחדרים', async () => {
    renderWithProviders(<FloorMapPage />);

    expect(await screen.findByText('קומה 1 - קליטה ותשתיות')).toBeInTheDocument();
    expect(screen.getByText('מסדרון מרכזי')).toBeInTheDocument();
    expect(screen.getByText('101')).toBeInTheDocument();
    expect(screen.getByText('12 פריטים')).toBeInTheDocument();
  });

  it('מאפשרת מעבר בין קומות', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FloorMapPage />);

    await screen.findByText('קומה 1 - קליטה ותשתיות');
    await user.click(screen.getByRole('tab', { name: 'קומה 2' }));

    await waitFor(() => expect(selectedFloorId.current).toBe('map-2'));
    expect(await screen.findByText('קומה 2 - פיתוח ומוצר')).toBeInTheDocument();
  });

  it('לחיצה על חדר פותחת פאנל עם המלאי התואם', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FloorMapPage />);

    const room = await screen.findByRole('button', {
      name: /חדר 101, קבלה לוגיסטית/,
    });
    await user.click(room);

    const drawer = await screen.findByRole('presentation');
    expect(within(drawer).getByText('חדר 101')).toBeInTheDocument();
    expect(within(drawer).getByText('עכבר אלחוטי')).toBeInTheDocument();
    expect(within(drawer).getByText(/מזהה LT-0007 · בעלים: מאיה כהן/)).toBeInTheDocument();
  });

  it('חיפוש לפי שם בעלים מציג תוצאה עם הקומה הנכונה', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FloorMapPage />);

    await user.type(screen.getByLabelText('חיפוש במפת החדרים'), 'מאיה');

    expect(await screen.findByText(/קומה 2 · חדר 201/)).toBeInTheDocument();
    expect(screen.getByText('בעלים: מאיה כהן')).toBeInTheDocument();
  });

  it('מציגה מקרא טקסטואלי לכל מצב חדר', async () => {
    renderWithProviders(<FloorMapPage />);
    await screen.findByText('קומה 1 - קליטה ותשתיות');

    for (const label of ['ללא ציוד', 'יש ציוד', 'ציוד בדרך', 'ציוד הגיע']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });
});

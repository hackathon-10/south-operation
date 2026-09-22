import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/utils';
import { MissionBuilderPage } from './MissionBuilderPage';

const createMission = vi.fn().mockResolvedValue({ id: 'mission-1' });
const suggestRoute = vi.fn().mockResolvedValue({
  stops: [
    {
      baseId: 'base-hub',
      baseCode: 'KT',
      baseName: 'קריית התקשוב',
      stopType: 'START',
      sequence: 0,
      packageCount: 0,
      highestPriority: null,
      longestWaitHours: 0,
    },
    {
      baseId: 'base-gdn',
      baseCode: 'GDN',
      baseName: 'גדעונים',
      stopType: 'PICKUP',
      sequence: 1,
      packageCount: 1,
      highestPriority: 'HIGH',
      longestWaitHours: 30,
    },
    {
      baseId: 'base-hub',
      baseCode: 'KT',
      baseName: 'קריית התקשוב',
      stopType: 'DELIVERY_HUB',
      sequence: 2,
      packageCount: 0,
      highestPriority: null,
      longestWaitHours: 0,
    },
  ],
  legs: [],
  totalDistanceKm: 120.5,
  totalDurationMinutes: 180,
  optimizationScore: 72,
  explanation: ['המסלול מאחד בסיס איסוף אחד', 'זו הצעה לשיקול המפקד'],
  estimatedTripsSaved: 0,
});

vi.mock('../../api/queries', () => ({
  useBases: () => ({
    data: [
      { id: 'base-hub', code: 'KT', name: 'קריית התקשוב', isDestinationHub: true },
      { id: 'base-gdn', code: 'GDN', name: 'גדעונים', isDestinationHub: false },
    ],
  }),
  useUsers: () => ({
    data: { items: [{ id: 'soldier-1', fullName: 'רס״ל אלה מאיר', baseName: 'גדעונים' }] },
  }),
  usePackages: () => ({
    data: {
      items: [
        {
          id: 'pkg-1',
          packageNumber: 'PKG-10001',
          status: 'READY_FOR_SHIPMENT',
          priority: 'HIGH',
          sourceBaseName: 'גדעונים',
          sourceRoomName: 'חדר פיתוח א׳',
          destinationRoomName: 'צוות פיתוח א׳',
          destination: { building: 'בניין תקשוב מרכזי', floor: '2', roomNumber: '201' },
          totalUnits: 9,
          itemLineCount: 3,
          teamId: 'team-1',
          teamName: 'צוות פיתוח א׳',
          missionId: null,
          missionNumber: null,
          sealedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          packageType: 'PROFESSIONAL_BOX',
        },
      ],
      page: 1,
      pageSize: 100,
      total: 1,
      totalPages: 1,
    },
    isLoading: false,
  }),
  useCreateMission: () => ({ mutateAsync: createMission, isPending: false }),
  useRouteSuggestion: () => ({ mutateAsync: suggestRoute, isPending: false }),
}));

describe('בניית שליחות', () => {
  it('שדה הנחיות הנסיעה המאובטחת מופיע רק כשהמתג דולק ונשלח לשרת', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MissionBuilderPage />);

    expect(screen.queryByLabelText('הנחיות (מוצגות למורשים בלבד)')).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('בחירת אריזה PKG-10001'));
    await user.type(screen.getByLabelText('כותרת השליחות'), 'איסוף מגדעונים');

    const departure = screen.getByLabelText('תאריך ושעת יציאה');
    await user.type(departure, '2026-03-01T06:30');

    await user.click(screen.getByRole('checkbox', { name: /נדרשת נסיעה מאובטחת/ }));

    const notes = await screen.findByLabelText('הנחיות (מוצגות למורשים בלבד)');
    await user.type(notes, 'ליווי לפי נוהל');

    await user.click(screen.getByRole('button', { name: 'יצירת השליחות' }));

    await waitFor(() => expect(createMission).toHaveBeenCalled());
    const payload = createMission.mock.calls[0][0];
    expect(payload.requiresSecuredTransport).toBe(true);
    expect(payload.securedTransportNotes).toBe('ליווי לפי נוהל');
    expect(payload.packageIds).toEqual(['pkg-1']);
  });

  it('הצעת המסלול מציגה את ההסבר למפקד', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MissionBuilderPage />);

    await user.click(screen.getByLabelText('בחירת אריזה PKG-10001'));
    await user.click(screen.getByRole('button', { name: 'הצעת מסלול' }));

    expect(await screen.findByText('המסלול המוצע')).toBeInTheDocument();
    expect(screen.getByText('• המסלול מאחד בסיס איסוף אחד')).toBeInTheDocument();
    expect(screen.getByText('• זו הצעה לשיקול המפקד')).toBeInTheDocument();
    expect(screen.getByText('120.5 ק״מ')).toBeInTheDocument();
  });
});

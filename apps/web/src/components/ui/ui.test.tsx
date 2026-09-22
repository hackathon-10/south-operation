import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { renderWithProviders } from '../../test/utils';
import { CardSkeletonGrid, EmptyState, ErrorState, SuccessState } from './States';
import { ProgressRing } from './ProgressRing';
import { StatusBadge } from './StatusBadge';
import { extractTokenFromScan } from './ScannerDialog';

describe('מצבי מסך', () => {
  it('מצב טעינה מציג שלד כרטיסים', () => {
    const { container } = renderWithProviders(<CardSkeletonGrid count={3} />);
    expect(container.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
  });

  it('מצב ריק מסביר מה אין ומציע פעולה', () => {
    renderWithProviders(
      <EmptyState title="לא נמצאו אריזות" description="אפשר לנקות את הסינון" />,
    );
    expect(screen.getByText('לא נמצאו אריזות')).toBeInTheDocument();
    expect(screen.getByText('אפשר לנקות את הסינון')).toBeInTheDocument();
  });

  it('מצב שגיאה מציג הודעה בעברית ולא קוד סטטוס', async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    const error = new AxiosError('Request failed');
    error.response = {
      status: 403,
      data: { statusCode: 403, code: 'FORBIDDEN_PACKAGE_SCOPE', message: 'אין לך הרשאה לצפות באריזה הזו' },
    } as never;

    renderWithProviders(<ErrorState error={error} onRetry={retry} />);

    expect(screen.getByText('אין לך הרשאה לצפות באריזה הזו')).toBeInTheDocument();
    expect(screen.queryByText('403')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'נסו שוב' }));
    expect(retry).toHaveBeenCalled();
  });

  it('מצב הצלחה מציג את פעולת ההמשך', () => {
    renderWithProviders(
      <SuccessState title="אריזה PKG-10001 נסגרה בהצלחה" description="7 יחידות" />,
    );
    expect(screen.getByText('אריזה PKG-10001 נסגרה בהצלחה')).toBeInTheDocument();
  });
});

describe('התקדמות ותגי סטטוס', () => {
  it('טבעת ההתקדמות מציגה אחוז ונגישה לקורא מסך', () => {
    renderWithProviders(<ProgressRing value={62} />);
    expect(screen.getByText('62%')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'התקדמות 62 אחוזים' })).toBeInTheDocument();
  });

  it('טבעת ההתקדמות חוסמת ערכים מחוץ לתחום', () => {
    const { rerender } = renderWithProviders(<ProgressRing value={-20} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
    rerender(<ProgressRing value={180} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('תג הסטטוס מציג טקסט מלא ולא רק צבע', () => {
    renderWithProviders(<StatusBadge label="מוכנה לשילוח" tone="primary" />);
    expect(screen.getByText('מוכנה לשילוח')).toBeInTheDocument();
  });
});

describe('סריקת QR', () => {
  it('מחלץ Token מתוך כתובת הסריקה', () => {
    const token = 'A'.repeat(32);
    expect(extractTokenFromScan(`https://app.demo/scan/package/${token}`)).toBe(token);
  });

  it('מקבל Token גולמי שהודבק ידנית', () => {
    const token = 'abcDEF123_-'.padEnd(28, 'x');
    expect(extractTokenFromScan(token)).toBe(token);
  });

  it('דוחה מספר אריזה כאילו היה Token', () => {
    expect(extractTokenFromScan('PKG-10001')).toBeNull();
  });
});

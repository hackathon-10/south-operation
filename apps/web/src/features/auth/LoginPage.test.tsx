import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserRole } from '@south/shared';
import { renderWithProviders } from '../../test/utils';
import { LoginPage } from './LoginPage';

const login = vi.fn();
const demoUsers = vi.fn();

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isBootstrapping: false,
    login,
    logout: vi.fn(),
    hasRole: () => false,
    demoUsers,
  }),
}));

describe('מסך ההתחברות', () => {
  beforeEach(() => {
    demoUsers.mockResolvedValue({ users: [], demoPassword: null });
    login.mockReset();
  });

  it('מציג שגיאות ולידציה בעברית ולא שולח את הטופס', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText('אימייל'), 'not-an-email');
    await user.type(screen.getByLabelText('סיסמה'), '123');
    await user.click(screen.getByRole('button', { name: 'כניסה' }));

    expect(await screen.findByText('כתובת האימייל אינה תקינה')).toBeInTheDocument();
    expect(screen.getByText('הסיסמה חייבת להכיל לפחות 8 תווים')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('שולח את הטופס כאשר הפרטים תקינים', async () => {
    const user = userEvent.setup();
    login.mockResolvedValue({ id: '1', role: UserRole.LOGISTICS_SOLDIER });
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText('אימייל'), 'soldier@south.demo');
    await user.type(screen.getByLabelText('סיסמה'), 'Demo!2345');
    await user.click(screen.getByRole('button', { name: 'כניסה' }));

    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({
        email: 'soldier@south.demo',
        password: 'Demo!2345',
      }),
    );
  });

  it('מציג הודעה אנושית כאשר ההתחברות נכשלת, בלי קוד סטטוס', async () => {
    const user = userEvent.setup();
    login.mockRejectedValue(new Error('fail'));
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText('אימייל'), 'soldier@south.demo');
    await user.type(screen.getByLabelText('סיסמה'), 'Demo!2345');
    await user.click(screen.getByRole('button', { name: 'כניסה' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBeTruthy();
    expect(alert.textContent).not.toMatch(/\b40[0-9]\b|\b500\b/);
  });

  it('בחירת משתמש דמו ממלאת את הטופס בלי לדלג על ההתחברות', async () => {
    const user = userEvent.setup();
    demoUsers.mockResolvedValue({
      demoPassword: 'Demo!2345',
      users: [
        {
          email: 'commander@south.demo',
          fullName: 'סרן דנה אביב',
          role: UserRole.LOGISTICS_COMMANDER,
          description: 'מפקדת הלוגיסטיקה',
        },
      ],
    });

    renderWithProviders(<LoginPage />);

    const demoButton = await screen.findByText('סרן דנה אביב');
    await user.click(demoButton);

    await waitFor(() =>
      expect(screen.getByLabelText('אימייל')).toHaveValue('commander@south.demo'),
    );
    expect(screen.getByLabelText('סיסמה')).toHaveValue('Demo!2345');
    expect(login).not.toHaveBeenCalled();
  });
});

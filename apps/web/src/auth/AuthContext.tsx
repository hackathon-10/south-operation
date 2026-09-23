import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthUserDto, DemoUserDto, LoginInput, LoginResponseDto, UserRole } from '@south/shared';
import { api, refreshAccessToken, setAccessToken, setUnauthenticatedHandler } from '../api/client';

interface AuthContextValue {
  user: AuthUserDto | null;
  isBootstrapping: boolean;
  login: (input: LoginInput) => Promise<AuthUserDto>;
  logout: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
  demoUsers: () => Promise<{ users: DemoUserDto[]; demoPassword: string | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUserDto | null>(null);
  const [isBootstrapping, setBootstrapping] = useState(true);
  const queryClient = useQueryClient();

  /**
   * בעליית האפליקציה מנסים לחדש את הסשן מתוך ה-Refresh Token שב-cookie.
   * כך רענון דף לא מנתק את המשתמש, והטוקן עצמו לעולם לא נשמר ב-localStorage.
   *
   * תגובת הרענון כוללת כבר את פרטי המשתמש, ולכן אין כאן קריאה נוספת ל-/auth/me:
   * המסך הראשון מחכה לסיבוב רשת אחד במקום לשניים בטור.
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const refreshed = await refreshAccessToken();
      if (cancelled) return;

      if (refreshed) setUser(refreshed.user);
      setBootstrapping(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setUnauthenticatedHandler(() => {
      setAccessToken(null);
      setUser(null);
      queryClient.clear();
    });
    return () => setUnauthenticatedHandler(null);
  }, [queryClient]);

  const login = useCallback(
    async (input: LoginInput) => {
      const response = await api.post<LoginResponseDto>('/auth/login', input);
      setAccessToken(response.data.accessToken);
      setUser(response.data.user);
      queryClient.clear();
      return response.data.user;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      setUser(null);
      queryClient.clear();
    }
  }, [queryClient]);

  const hasRole = useCallback(
    (...roles: UserRole[]) => Boolean(user && roles.includes(user.role)),
    [user],
  );

  const demoUsers = useCallback(async () => {
    const response = await api.get<{ users: DemoUserDto[]; demoPassword: string | null }>(
      '/auth/demo-users',
    );
    return response.data;
  }, []);

  const value = useMemo(
    () => ({ user, isBootstrapping, login, logout, hasRole, demoUsers }),
    [user, isBootstrapping, login, logout, hasRole, demoUsers],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

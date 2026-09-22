import { Box, CircularProgress } from '@mui/material';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactElement } from 'react';
import { UserRole } from '@south/shared';
import { useAuth } from './auth/AuthContext';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './features/auth/LoginPage';
import { HomePage } from './features/dashboard/HomePage';
import { TasksPage } from './features/tasks/TasksPage';
import { TaskDetailPage } from './features/tasks/TaskDetailPage';
import { CreateTaskPage } from './features/tasks/CreateTaskPage';
import { PackagesPage } from './features/packages/PackagesPage';
import { PackageDetailPage } from './features/packages/PackageDetailPage';
import { PackageLabelPage } from './features/packages/PackageLabelPage';
import { MissionsPage } from './features/missions/MissionsPage';
import { MissionDetailPage } from './features/missions/MissionDetailPage';
import { MissionBuilderPage } from './features/missions/MissionBuilderPage';
import { JoinRequestsPage } from './features/missions/JoinRequestsPage';
import { FloorMapPage } from './features/map/FloorMapPage';
import { ScanPage } from './features/scan/ScanPage';
import { ScanResultPage } from './features/scan/ScanResultPage';
import { AuditPage } from './features/audit/AuditPage';
import { NotFoundPage } from './features/shared/NotFoundPage';
import { ForbiddenPage } from './features/shared/ForbiddenPage';

function FullScreenLoader() {
  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
      <CircularProgress aria-label="טוען" />
    </Box>
  );
}

/**
 * שער הגישה בצד הלקוח.
 * זו חוויית משתמש בלבד - האכיפה האמיתית היא בשרת בכל קריאה (§5.4).
 */
function Protected({ children, roles }: { children: ReactElement; roles?: UserRole[] }) {
  const { user, isBootstrapping } = useAuth();
  const location = useLocation();

  if (isBootstrapping) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (roles && !roles.includes(user.role)) return <ForbiddenPage />;

  return children;
}

export function App() {
  const { user, isBootstrapping } = useAuth();

  if (isBootstrapping) return <FullScreenLoader />;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />

      <Route
        element={
          <Protected>
            <AppShell />
          </Protected>
        }
      >
        <Route path="/" element={<HomePage />} />

        <Route path="/tasks" element={<TasksPage />} />
        <Route
          path="/tasks/new"
          element={
            <Protected roles={[UserRole.LOGISTICS_COMMANDER]}>
              <CreateTaskPage />
            </Protected>
          }
        />
        <Route path="/tasks/:taskId" element={<TaskDetailPage />} />

        <Route path="/packages" element={<PackagesPage />} />
        <Route path="/packages/:packageId" element={<PackageDetailPage />} />
        <Route path="/packages/:packageId/label" element={<PackageLabelPage />} />

        <Route
          path="/missions"
          element={
            <Protected roles={[UserRole.LOGISTICS_COMMANDER, UserRole.LOGISTICS_SOLDIER]}>
              <MissionsPage />
            </Protected>
          }
        />
        <Route
          path="/missions/new"
          element={
            <Protected roles={[UserRole.LOGISTICS_COMMANDER]}>
              <MissionBuilderPage />
            </Protected>
          }
        />
        <Route
          path="/missions/:missionId"
          element={
            <Protected roles={[UserRole.LOGISTICS_COMMANDER, UserRole.LOGISTICS_SOLDIER]}>
              <MissionDetailPage />
            </Protected>
          }
        />

        <Route
          path="/join-requests"
          element={
            <Protected roles={[UserRole.LOGISTICS_COMMANDER]}>
              <JoinRequestsPage />
            </Protected>
          }
        />

        <Route path="/map" element={<FloorMapPage />} />
        <Route path="/scan" element={<ScanPage />} />
        <Route path="/scan/package/:publicToken" element={<ScanResultPage />} />

        <Route
          path="/audit"
          element={
            <Protected roles={[UserRole.LOGISTICS_COMMANDER]}>
              <AuditPage />
            </Protected>
          }
        />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

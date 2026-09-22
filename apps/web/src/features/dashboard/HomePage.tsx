import { UserRole } from '@south/shared';
import { useAuth } from '../../auth/AuthContext';
import { CommanderDashboard } from './CommanderDashboard';
import { SoldierHome } from './SoldierHome';
import { TeamLeadOverview } from './TeamLeadOverview';

/** דף הבית נבחר לפי תפקיד המשתמש (§10.3 - §10.5). */
export function HomePage() {
  const { user } = useAuth();
  if (!user) return null;

  switch (user.role) {
    case UserRole.LOGISTICS_COMMANDER:
      return <CommanderDashboard />;
    case UserRole.LOGISTICS_SOLDIER:
      return <SoldierHome />;
    case UserRole.TEAM_LEAD:
    default:
      return <TeamLeadOverview />;
  }
}

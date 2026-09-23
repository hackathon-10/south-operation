import { UserRole } from '@south/shared';
import { useAuth } from '../../auth/AuthContext';
import { CommanderDashboard } from './CommanderDashboard';
import { OperationDashboard } from './OperationDashboard';
import { SoldierHome } from './SoldierHome';
import { TeamLeadOverview } from './TeamLeadOverview';

/**
 * דף הבית נבחר לפי תפקיד המשתמש (§10.3 - §10.6).
 *
 * כל תפקיד מקבל ענף מפורש. אין כאן `default` שמחזיר מסך של תפקיד אחר:
 * תפקיד חדש שיתווסף ל-UserRole ישבור את הקומפילציה כאן ולא יקבל בשקט
 * את המסך של ראש הצוות.
 */
export function HomePage() {
  const { user } = useAuth();
  if (!user) return null;

  switch (user.role) {
    case UserRole.LOGISTICS_COMMANDER:
      return <CommanderDashboard />;
    case UserRole.OPERATION_COMMANDER:
      return <OperationDashboard />;
    case UserRole.LOGISTICS_SOLDIER:
      return <SoldierHome />;
    case UserRole.TEAM_LEAD:
      return <TeamLeadOverview />;
    default:
      return assertUnreachable(user.role);
  }
}

/** שומר מיצוי: תפקיד שלא טופל למעלה ייכשל בקומפילציה, לא בזמן ריצה. */
function assertUnreachable(role: never): never {
  throw new Error(`תפקיד לא מוכר: ${String(role)}`);
}

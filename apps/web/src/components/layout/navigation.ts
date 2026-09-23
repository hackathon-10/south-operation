import type { ComponentType } from 'react';
import type { SvgIconProps } from '@mui/material';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import QrCodeScannerRoundedIcon from '@mui/icons-material/QrCodeScannerRounded';
import RuleFolderRoundedIcon from '@mui/icons-material/RuleFolderRounded';
import { UserRole } from '@south/shared';

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<SvgIconProps>;
  roles: UserRole[];
  /** האם להציג בניווט התחתון במובייל. */
  mobile?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'דשבורד',
    icon: DashboardRoundedIcon,
    roles: [
      UserRole.LOGISTICS_COMMANDER,
      UserRole.OPERATION_MANAGER,
      UserRole.LOGISTICS_SOLDIER,
      UserRole.TEAM_LEAD,
    ],
    mobile: true,
  },
  {
    to: '/tasks',
    label: 'משימות אריזה',
    icon: AssignmentRoundedIcon,
    roles: [UserRole.LOGISTICS_COMMANDER, UserRole.LOGISTICS_SOLDIER, UserRole.TEAM_LEAD],
    mobile: true,
  },
  {
    to: '/packages',
    label: 'אריזות',
    icon: Inventory2RoundedIcon,
    roles: [UserRole.LOGISTICS_COMMANDER, UserRole.LOGISTICS_SOLDIER, UserRole.TEAM_LEAD],
    mobile: true,
  },
  {
    to: '/missions',
    label: 'שליחויות',
    icon: LocalShippingRoundedIcon,
    roles: [UserRole.LOGISTICS_COMMANDER, UserRole.LOGISTICS_SOLDIER],
    mobile: true,
  },
  {
    to: '/join-requests',
    label: 'בקשות הצטרפות',
    icon: RuleFolderRoundedIcon,
    roles: [UserRole.LOGISTICS_COMMANDER, UserRole.OPERATION_MANAGER],
    mobile: true,
  },
  {
    to: '/scan',
    label: 'סריקת QR',
    icon: QrCodeScannerRoundedIcon,
    roles: [UserRole.LOGISTICS_SOLDIER, UserRole.TEAM_LEAD, UserRole.LOGISTICS_COMMANDER],
    mobile: true,
  },
  {
    to: '/map',
    label: 'מפת החדרים',
    icon: MapRoundedIcon,
    roles: [UserRole.LOGISTICS_COMMANDER, UserRole.LOGISTICS_SOLDIER, UserRole.TEAM_LEAD],
  },
];

/**
 * ניווט מפקד המבצע דק בכוונה: דשבורד ובקשות הצטרפות בלבד.
 * אל האריזות והשליחויות הוא מגיע בקדיחה משורה אדומה בדשבורד, לא מפריט קבוע.
 */
export function navItemsForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function mobileNavItemsForRole(role: UserRole): NavItem[] {
  return navItemsForRole(role).filter((item) => item.mobile);
}

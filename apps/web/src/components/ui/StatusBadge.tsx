import { Box } from '@mui/material';
import type { ReactNode } from 'react';
import { tones, type ToneName } from '../../theme/tokens';

interface StatusBadgeProps {
  label: string;
  tone: ToneName;
  icon?: ReactNode;
  size?: 'small' | 'medium';
}

/**
 * תג סטטוס: צבע + טקסט מלא.
 * לעולם לא מסתמכים על הצבע בלבד (נגישות, §10.1).
 */
export function StatusBadge({ label, tone, icon, size = 'medium' }: StatusBadgeProps) {
  const palette = tones[tone];
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        borderRadius: 999,
        backgroundColor: palette.main,
        color: palette.contrast,
        fontWeight: 700,
        fontSize: size === 'small' ? 11 : 12.5,
        lineHeight: 1.6,
        paddingInline: size === 'small' ? 1 : 1.25,
        paddingBlock: size === 'small' ? 0.1 : 0.35,
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {label}
    </Box>
  );
}

/** גרסה רכה לשימוש על רקע לבן, כשיש הרבה תגים בסמיכות. */
export function SoftBadge({ label, tone, icon }: StatusBadgeProps) {
  const palette = tones[tone];
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        borderRadius: 999,
        backgroundColor: palette.soft,
        color: palette.main,
        fontWeight: 700,
        fontSize: 12,
        paddingInline: 1.1,
        paddingBlock: 0.25,
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {label}
    </Box>
  );
}

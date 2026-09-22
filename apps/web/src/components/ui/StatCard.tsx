import { Box, Card, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { palette, tones, type ToneName } from '../../theme/tokens';

interface StatCardProps {
  value: number | string;
  label: string;
  tone?: ToneName;
  icon?: ReactNode;
  hint?: string;
  onClick?: () => void;
}

/** אריח מדד: אייקון עגול על רקע רך, מספר גדול ותווית. */
export function StatCard({ value, label, tone = 'primary', icon, hint, onClick }: StatCardProps) {
  const color = tones[tone];

  return (
    <Card
      onClick={onClick}
      sx={{
        p: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        backgroundColor: color.soft,
        borderColor: 'transparent',
        boxShadow: 'none',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform .15s ease, box-shadow .15s ease',
        '&:hover': onClick
          ? { transform: 'translateY(-2px)', boxShadow: '0 8px 20px rgba(15,23,42,.08)' }
          : undefined,
      }}
    >
      {icon && (
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            backgroundColor: color.main,
            color: color.contrast,
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          {icon}
        </Box>
      )}
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>{value}</Typography>
        <Typography sx={{ fontSize: 13, fontWeight: 600, color: palette.textSecondary }}>
          {label}
        </Typography>
        {hint && (
          <Typography sx={{ fontSize: 11.5, color: palette.textSecondary, mt: 0.25 }}>
            {hint}
          </Typography>
        )}
      </Box>
    </Card>
  );
}

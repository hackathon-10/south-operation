import { Box, Card, Divider, Stack, Typography } from '@mui/material';
import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded';
import type { ReactNode } from 'react';
import { palette, tones, type ToneName } from '../../theme/tokens';
import { ProgressRing } from './ProgressRing';
import { StatusBadge } from './StatusBadge';

export interface MetaItem {
  icon: ReactNode;
  label: string;
  value: string;
}

interface EntityCardProps {
  /** מספר הישות, לדוגמה PKG-10425 */
  identifier: string;
  title: string;
  statusLabel: string;
  tone: ToneName;
  progress?: number;
  icon?: ReactNode;
  route?: { from: string; to: string };
  meta?: MetaItem[];
  footer?: ReactNode;
  onClick?: () => void;
  highlight?: boolean;
  children?: ReactNode;
}

/**
 * כרטיס ישות אחיד (משימה / אריזה / שליחות) לפי שפת העיצוב:
 * תג סטטוס, מספר, כותרת, טבעת התקדמות, שורת מסלול, מטא-גריד וקישורי פעולה.
 */
export function EntityCard({
  identifier,
  title,
  statusLabel,
  tone,
  progress,
  icon,
  route,
  meta = [],
  footer,
  onClick,
  highlight,
  children,
}: EntityCardProps) {
  const color = tones[tone];

  return (
    <Card
      onClick={onClick}
      tabIndex={onClick ? 0 : undefined}
      role={onClick ? 'button' : undefined}
      onKeyDown={(event) => {
        if (onClick && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onClick();
        }
      }}
      sx={{
        p: 2,
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: highlight ? color.soft : palette.surface,
        transition: 'transform .15s ease, box-shadow .15s ease, border-color .15s ease',
        '&:hover': onClick
          ? { transform: 'translateY(-2px)', boxShadow: '0 10px 28px rgba(15,23,42,.10)' }
          : undefined,
        '&::before': {
          content: '""',
          position: 'absolute',
          insetInlineStart: 0,
          top: 0,
          bottom: 0,
          width: 4,
          backgroundColor: color.main,
        },
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
        <StatusBadge label={statusLabel} tone={tone} />
        {progress !== undefined && <ProgressRing value={progress} tone={tone} />}
      </Stack>

      <Stack direction="row" alignItems="flex-start" gap={1.5} sx={{ mt: 1.25 }}>
        {icon && (
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              backgroundColor: palette.slateSoft,
              color: palette.textSecondary,
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            {icon}
          </Box>
        )}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            sx={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
            dir="ltr"
            textAlign="start"
          >
            {identifier}
          </Typography>
          <Typography sx={{ fontSize: 15, fontWeight: 700, mt: 0.25 }} noWrap title={title}>
            {title}
          </Typography>
          {route && (
            <Stack direction="row" alignItems="center" gap={0.75} sx={{ mt: 0.75 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{route.from}</Typography>
              <Box component="span" sx={{ color: palette.textSecondary, fontSize: 14 }}>
                ←
              </Box>
              <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{route.to}</Typography>
            </Stack>
          )}
        </Box>
      </Stack>

      {meta.length > 0 && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
              columnGap: 2,
              rowGap: 1,
            }}
          >
            {meta.map((item) => (
              <Stack key={item.label} direction="row" alignItems="center" gap={0.75}>
                <Box sx={{ color: palette.textSecondary, display: 'flex' }} aria-hidden="true">
                  {item.icon}
                </Box>
                <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }}>
                  {item.label}:
                </Typography>
                <Typography sx={{ fontSize: 12.5, fontWeight: 600 }} noWrap title={item.value}>
                  {item.value}
                </Typography>
              </Stack>
            ))}
          </Box>
        </>
      )}

      {children}

      {footer && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            {footer}
          </Stack>
        </>
      )}
    </Card>
  );
}

/** קישור פעולה בתחתית הכרטיס, בסגנון "פרטים נוספים ›". */
export function CardLink({ label, icon }: { label: string; icon?: ReactNode }) {
  return (
    <Stack direction="row" alignItems="center" gap={0.5} sx={{ color: tones.primary.main }}>
      {icon}
      <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{label}</Typography>
      <ArrowBackIosNewRoundedIcon sx={{ fontSize: 12 }} />
    </Stack>
  );
}

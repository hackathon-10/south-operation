import { Box, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { palette, tones } from '../../theme/tokens';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
}

/** כותרת מסך אחידה: אייקון, כותרת, תת-כותרת ופעולה ראשית אחת בולטת. */
export function PageHeader({ title, subtitle, icon, action, secondaryAction }: PageHeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      alignItems={{ xs: 'flex-start', md: 'center' }}
      justifyContent="space-between"
      gap={2}
      sx={{ mb: 3 }}
    >
      <Stack direction="row" alignItems="center" gap={1.5}>
        {icon && (
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              backgroundColor: tones.primary.soft,
              color: tones.primary.main,
            }}
            aria-hidden="true"
          >
            {icon}
          </Box>
        )}
        <Box>
          <Typography component="h1" sx={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography sx={{ fontSize: 14, color: palette.textSecondary, mt: 0.25 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Stack>

      {(action || secondaryAction) && (
        <Stack direction="row" gap={1} sx={{ width: { xs: '100%', md: 'auto' } }}>
          {secondaryAction}
          {action}
        </Stack>
      )}
    </Stack>
  );
}

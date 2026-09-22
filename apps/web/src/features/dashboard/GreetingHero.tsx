import { Box, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { palette } from '../../theme/tokens';

function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'בוקר טוב';
  if (hour < 18) return 'צהריים טובים';
  return 'ערב טוב';
}

/** כרטיס פתיחה אישי עם ארבעה אריחי מדד, בהשראת מסכי ההשראה. */
export function GreetingHero({
  name,
  subtitle,
  tiles,
}: {
  name: string;
  subtitle: string;
  tiles: ReactNode;
}) {
  const firstName = name.split(' ').slice(-1)[0];

  return (
    <Box
      sx={{
        borderRadius: 3.5,
        overflow: 'hidden',
        border: `1px solid ${palette.border}`,
        backgroundColor: palette.surface,
        mb: 3,
      }}
    >
      <Box
        sx={{
          px: { xs: 2.5, md: 3 },
          py: { xs: 2.5, md: 3 },
          background: `linear-gradient(135deg, ${palette.navy900} 0%, ${palette.navy700} 70%, #2A5C90 100%)`,
          color: palette.textInverse,
          position: 'relative',
        }}
      >
        <Box
          aria-hidden="true"
          sx={{
            position: 'absolute',
            insetInlineEnd: -40,
            top: -60,
            width: 220,
            height: 220,
            borderRadius: '50%',
            background: 'rgba(255,255,255,.06)',
          }}
        />
        <Typography sx={{ fontSize: 26, fontWeight: 800, lineHeight: 1.2 }}>
          {greetingForNow()}, {firstName}
        </Typography>
        <Typography sx={{ fontSize: 14, opacity: 0.85, mt: 0.5 }}>{subtitle}</Typography>
      </Box>

      <Stack
        direction="row"
        sx={{
          p: { xs: 1.5, md: 2 },
          gap: { xs: 1.25, md: 2 },
          flexWrap: { xs: 'wrap', md: 'nowrap' },
          '& > *': { flex: { xs: '1 1 45%', md: 1 } },
        }}
      >
        {tiles}
      </Stack>
    </Box>
  );
}

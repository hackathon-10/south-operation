import { Box, Button, Stack, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import { palette } from '../../theme/tokens';

export function NotFoundPage() {
  return (
    <Box sx={{ minHeight: '60dvh', display: 'grid', placeItems: 'center', p: 3 }}>
      <Stack alignItems="center" gap={1.5} textAlign="center">
        <Typography sx={{ fontSize: 22, fontWeight: 800 }}>הדף שחיפשת לא נמצא</Typography>
        <Typography sx={{ fontSize: 14, color: palette.textSecondary }}>
          ייתכן שהקישור ישן או שהפריט הוסר מהמערכת
        </Typography>
        <Button component={Link} to="/" variant="contained" sx={{ mt: 1 }}>
          חזרה לדף הבית
        </Button>
      </Stack>
    </Box>
  );
}

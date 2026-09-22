import { Box, Button, Stack, Typography } from '@mui/material';
import LockPersonRoundedIcon from '@mui/icons-material/LockPersonRounded';
import { Link } from 'react-router-dom';
import { palette, tones } from '../../theme/tokens';

/** מסך הרשאה חסרה - הודעה אנושית, בלי קוד סטטוס. */
export function ForbiddenPage() {
  return (
    <Box sx={{ minHeight: '60dvh', display: 'grid', placeItems: 'center', p: 3 }}>
      <Stack alignItems="center" gap={1.5} textAlign="center">
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            backgroundColor: tones.warning.soft,
            color: tones.warning.main,
          }}
          aria-hidden="true"
        >
          <LockPersonRoundedIcon fontSize="large" />
        </Box>
        <Typography sx={{ fontSize: 22, fontWeight: 800 }}>
          התפקיד שלך אינו מורשה למסך הזה
        </Typography>
        <Typography sx={{ fontSize: 14, color: palette.textSecondary }}>
          אפשר לחזור לדף הבית ולהמשיך מהמסכים שמיועדים לך
        </Typography>
        <Button component={Link} to="/" variant="contained" sx={{ mt: 1 }}>
          חזרה לדף הבית
        </Button>
      </Stack>
    </Box>
  );
}

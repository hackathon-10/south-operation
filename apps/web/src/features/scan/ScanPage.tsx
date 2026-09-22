import { useState } from 'react';
import { Alert, Box, Button, Card, Stack, Typography } from '@mui/material';
import QrCodeScannerRoundedIcon from '@mui/icons-material/QrCodeScannerRounded';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import type { PaginatedResult, PackageSummaryDto } from '@south/shared';
import { PageHeader } from '../../components/ui/PageHeader';
import { ScannerDialog } from '../../components/ui/ScannerDialog';
import { palette, tones } from '../../theme/tokens';

/** מסך הסריקה - נקודת הכניסה המהירה של איש השטח (§10.4). */
export function ScanPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notFound, setNotFound] = useState<string | null>(null);

  const handleResult = async (result: { token?: string; packageNumber?: string }) => {
    setNotFound(null);

    if (result.token) {
      setOpen(false);
      navigate(`/scan/package/${result.token}`);
      return;
    }

    if (result.packageNumber) {
      try {
        const response = await api.get<PaginatedResult<PackageSummaryDto>>('/packages', {
          params: { search: result.packageNumber, pageSize: 5 },
        });
        const match = response.data.items.find(
          (item) => item.packageNumber.toUpperCase() === result.packageNumber!.toUpperCase(),
        );
        if (match) {
          setOpen(false);
          navigate(`/packages/${match.id}`);
        } else {
          setNotFound('לא נמצאה אריזה עם המספר הזה. בדקו את המספר ונסו שוב');
        }
      } catch {
        setNotFound('לא הצלחנו לחפש את האריזה כרגע. נסו שוב בעוד רגע');
      }
    }
  };

  return (
    <Box>
      <PageHeader
        title="סריקת אריזה"
        subtitle="סורקים את ה-QR שעל האריזה ומקבלים בדיוק את הפעולה הנכונה"
        icon={<QrCodeScannerRoundedIcon />}
      />

      {notFound && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setNotFound(null)}>
          {notFound}
        </Alert>
      )}

      <Card sx={{ p: { xs: 3, md: 5 }, textAlign: 'center' }}>
        <Box
          sx={{
            width: 96,
            height: 96,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            backgroundColor: tones.primary.soft,
            color: tones.primary.main,
            mx: 'auto',
            mb: 2,
          }}
          aria-hidden="true"
        >
          <QrCodeScannerRoundedIcon sx={{ fontSize: 48 }} />
        </Box>

        <Typography sx={{ fontSize: 20, fontWeight: 800 }}>מוכנים לסריקה</Typography>
        <Typography sx={{ fontSize: 14, color: palette.textSecondary, mt: 0.5, mb: 3 }}>
          המערכת תזהה את האריזה ותציע את הפעולה המתאימה לשלב שבו היא נמצאת
        </Typography>

        <Button
          variant="contained"
          size="large"
          startIcon={<QrCodeScannerRoundedIcon />}
          onClick={() => setOpen(true)}
          sx={{ minWidth: 220 }}
        >
          פתיחת הסורק
        </Button>

        <Stack sx={{ mt: 3 }} gap={0.5}>
          <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }}>
            אין גישה למצלמה? אפשר להזין מספר אריזה ידנית מתוך חלון הסריקה
          </Typography>
          <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }}>
            הרשאת המצלמה מתבקשת רק בזמן הסריקה
          </Typography>
        </Stack>
      </Card>

      <ScannerDialog open={open} onClose={() => setOpen(false)} onResult={handleResult} />
    </Box>
  );
}

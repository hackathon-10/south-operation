import { Box, Button, Card, Divider, Stack, Typography } from '@mui/material';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePackageLabel } from '../../api/queries';
import { PageHeader } from '../../components/ui/PageHeader';
import { ErrorState, ListSkeleton } from '../../components/ui/States';
import { palette } from '../../theme/tokens';
import { formatDateTime } from '../../utils/format';

/**
 * תווית האריזה להדפסה (§8.4).
 *
 * ה-QR מכיל URL עם Token אקראי בלבד: אין בו שם, בעלים, יחידה, חדר או מק״ט.
 * שאר פרטי התווית מודפסים כטקסט לנוחות הצוות בשטח.
 */
export function PackageLabelPage() {
  const { packageId } = useParams<{ packageId: string }>();
  const navigate = useNavigate();
  const { data: label, isLoading, error, refetch } = usePackageLabel(packageId);

  if (isLoading) return <ListSkeleton rows={4} />;
  if (error || !label) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <Box>
      <PageHeader
        title="תווית אריזה"
        subtitle="להדפסה והדבקה על האריזה"
        icon={<PrintRoundedIcon />}
        action={
          <Button
            variant="contained"
            size="large"
            startIcon={<PrintRoundedIcon />}
            onClick={() => window.print()}
            fullWidth
          >
            הדפסה
          </Button>
        }
        secondaryAction={
          <Button
            variant="outlined"
            size="large"
            startIcon={<ArrowForwardRoundedIcon />}
            onClick={() => navigate(`/packages/${packageId}`)}
          >
            חזרה לאריזה
          </Button>
        }
      />

      <Card id="print-area" sx={{ p: 3, maxWidth: 560, mx: 'auto' }}>
        <Stack alignItems="center" gap={1}>
          <Typography sx={{ fontSize: 13, color: palette.textSecondary, letterSpacing: 2 }}>
            המעבר דרומה
          </Typography>
          <Typography
            sx={{ fontSize: 40, fontWeight: 800, letterSpacing: 1 }}
            dir="ltr"
          >
            {label.packageNumber}
          </Typography>

          <Box sx={{ p: 2, backgroundColor: '#fff', borderRadius: 2 }}>
            <QRCodeSVG value={label.qrUrl} size={208} level="M" includeMargin={false} />
          </Box>

          <Typography sx={{ fontSize: 12, color: palette.textSecondary }}>
            סריקה דורשת התחברות והרשאה
          </Typography>
        </Stack>

        <Divider sx={{ my: 2.5 }} />

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <LabelField title="בסיס מקור" value={label.sourceBaseName} />
          <LabelField title="חדר מקור" value={label.sourceRoomName} />
          <LabelField title="צוות" value={label.teamName} />
          <LabelField title="תאריך סגירה" value={formatDateTime(label.sealedAt)} />
        </Box>

        <Box
          sx={{
            mt: 2.5,
            p: 2,
            borderRadius: 2,
            border: `2px solid ${palette.textPrimary}`,
            textAlign: 'center',
          }}
        >
          <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }}>יעד</Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 800 }}>
            {label.destination.building}
          </Typography>
          <Typography sx={{ fontSize: 30, fontWeight: 800, mt: 0.5 }}>
            קומה {label.destination.floor} · חדר {label.destination.roomNumber}
          </Typography>
          <Typography sx={{ fontSize: 15, fontWeight: 600 }}>
            {label.destination.displayName}
          </Typography>
        </Box>

        <Stack direction="row" justifyContent="space-between" sx={{ mt: 2.5 }}>
          <LabelField title="מספר שורות" value={String(label.lineCount)} />
          <LabelField title="סה״כ יחידות" value={String(label.totalUnits)} />
          <LabelField title="הודפס" value={formatDateTime(label.printedAt)} />
        </Stack>
      </Card>
    </Box>
  );
}

function LabelField({ title, value }: { title: string; value: string }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 12, color: palette.textSecondary }}>{title}</Typography>
      <Typography sx={{ fontSize: 15, fontWeight: 700 }}>{value}</Typography>
    </Box>
  );
}

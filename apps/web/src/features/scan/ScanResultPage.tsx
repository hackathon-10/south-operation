import { useState } from 'react';
import { Alert, Box, Button, Card, Chip, Divider, Stack, Typography } from '@mui/material';
import MoveToInboxRoundedIcon from '@mui/icons-material/MoveToInboxRounded';
import WarehouseRoundedIcon from '@mui/icons-material/WarehouseRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { Link, useParams } from 'react-router-dom';
import { useDeliverPackage, useReceivePackage, useScanPackage } from '../../api/queries';
import { toUserError } from '../../api/errors';
import { PageHeader } from '../../components/ui/PageHeader';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ErrorState, ListSkeleton } from '../../components/ui/States';
import { palette, tones } from '../../theme/tokens';
import { labels, packageTone } from '../../utils/status';

/**
 * תוצאת סריקה: מסך גדול וברור עם היעד והפעולה המומלצת (§8.9, §8.10).
 * ההרשאה נבדקת בשרת - סריקה אינה עוקפת התחברות.
 */
export function ScanResultPage() {
  const { publicToken } = useParams<{ publicToken: string }>();
  const { data, isLoading, error, refetch } = useScanPackage(publicToken);
  const receive = useReceivePackage();
  const deliver = useDeliverPackage();
  const [actionError, setActionError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (isLoading) return <ListSkeleton rows={5} />;
  if (error || !data) {
    return (
      <Box>
        <ErrorState
          error={error}
          onRetry={() => void refetch()}
          title="לא זיהינו את האריזה מהסריקה"
        />
        <Stack alignItems="center" sx={{ mt: 2 }}>
          <Button component={Link} to="/scan" variant="contained">
            סריקה חוזרת
          </Button>
        </Stack>
      </Box>
    );
  }

  const pkg = data.package;
  // מפתח Idempotency לפי הסריקה: סריקה חוזרת של אותה אריזה לא תיצור פעולה כפולה.
  const idempotencyKey = `scan-${pkg.id}-${pkg.status}`;

  const run = async (action: () => Promise<unknown>, successMessage: string) => {
    setActionError(null);
    try {
      await action();
      setDone(successMessage);
    } catch (failure) {
      const details = toUserError(failure);
      setActionError(details.hint ? `${details.message}. ${details.hint}` : details.message);
    }
  };

  return (
    <Box>
      <PageHeader
        title={`אריזה ${pkg.packageNumber}`}
        subtitle={data.suggestedActionLabel}
        icon={<Inventory2RoundedIcon />}
      />

      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      {done && (
        <Alert severity="success" icon={<CheckCircleRoundedIcon />} sx={{ mb: 2 }}>
          {done}
        </Alert>
      )}

      {/* היעד - הדבר החשוב ביותר במסך */}
      <Card
        sx={{
          p: { xs: 3, md: 4 },
          mb: 2.5,
          textAlign: 'center',
          backgroundColor: tones.primary.soft,
          borderColor: 'transparent',
        }}
      >
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: tones.primary.main }}>
          לאן לקחת את האריזה
        </Typography>
        <Typography sx={{ fontSize: 18, fontWeight: 700, mt: 1 }}>
          {pkg.destination.building}
        </Typography>
        <Typography sx={{ fontSize: 44, fontWeight: 800, lineHeight: 1.1, my: 0.5 }}>
          קומה {pkg.destination.floor} · חדר {pkg.destination.roomNumber}
        </Typography>
        <Typography sx={{ fontSize: 16, fontWeight: 600 }}>{pkg.destinationRoomName}</Typography>
      </Card>

      <Card sx={{ p: 2.5, mb: 2.5 }}>
        <Stack direction="row" gap={1} sx={{ flexWrap: 'wrap', mb: 2 }}>
          <StatusBadge label={labels.package[pkg.status]} tone={packageTone[pkg.status]} />
          <Chip size="small" label={`צוות: ${pkg.teamName}`} />
          <Chip size="small" label={`${pkg.totalUnits} יחידות`} />
          <Chip size="small" label={`${pkg.itemLineCount} שורות`} />
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
          <Box>
            <Typography sx={{ fontSize: 12, color: palette.textSecondary }}>מקור</Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
              {pkg.sourceBaseName} · {pkg.sourceRoomName}
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 12, color: palette.textSecondary }}>שליחות</Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
              {pkg.missionNumber ?? 'ללא שליחות'}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Stack gap={1}>
          {data.suggestedAction === 'RECEIVE' && pkg.permissions.canReceive && (
            <Button
              variant="contained"
              size="large"
              startIcon={<MoveToInboxRoundedIcon />}
              disabled={receive.isPending}
              onClick={() =>
                run(
                  () => receive.mutateAsync({ packageId: pkg.id, idempotencyKey }),
                  'האריזה נקלטה בקריית התקשוב',
                )
              }
            >
              התקבל בקריית התקשוב
            </Button>
          )}

          {data.suggestedAction === 'DELIVER' && pkg.permissions.canDeliver && (
            <Button
              variant="contained"
              size="large"
              startIcon={<WarehouseRoundedIcon />}
              disabled={deliver.isPending}
              onClick={() =>
                run(
                  () => deliver.mutateAsync({ packageId: pkg.id, idempotencyKey }),
                  'האריזה סומנה כהגיעה לחדר היעד',
                )
              }
            >
              האריזה הונחה בחדר היעד
            </Button>
          )}

          {data.suggestedAction === 'LOAD' && data.missionId && (
            <Button
              component={Link}
              to={`/missions/${data.missionId}`}
              variant="contained"
              size="large"
            >
              מעבר למסך ההעמסה של השליחות
            </Button>
          )}

          {data.suggestedAction === 'CONTINUE_PACKING' && (
            <Button component={Link} to={`/packages/${pkg.id}`} variant="contained" size="large">
              המשך אריזה
            </Button>
          )}

          <Button component={Link} to={`/packages/${pkg.id}`} size="large">
            צפייה בפרטי האריזה ובתכולה
          </Button>
          <Button component={Link} to="/scan" size="large">
            סריקת אריזה נוספת
          </Button>
        </Stack>
      </Card>

      {/* תכולה מקוצרת - חשוב לראש הצוות */}
      {(pkg.assets.length > 0 || pkg.bulkLines.length > 0) && (
        <Card sx={{ p: 2.5 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 1.5 }}>תכולת האריזה</Typography>
          <Stack divider={<Divider />}>
            {pkg.assets.map((asset) => (
              <Stack key={asset.id} sx={{ py: 1 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{asset.productName}</Typography>
                <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }}>
                  מזהה {asset.assetTag} · בעלים: {asset.ownerName}
                </Typography>
              </Stack>
            ))}
            {pkg.bulkLines.map((line) => (
              <Stack
                key={line.id}
                direction="row"
                justifyContent="space-between"
                sx={{ py: 1 }}
              >
                <Typography sx={{ fontSize: 14 }}>
                  {line.productName} · מק״ט {line.sku}
                </Typography>
                <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
                  {line.quantity} {line.unitOfMeasure}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Card>
      )}
    </Box>
  );
}

import { Box, Button, Card, Divider, LinearProgress, Stack, Typography } from '@mui/material';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ComputerRoundedIcon from '@mui/icons-material/ComputerRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { Link } from 'react-router-dom';
import { useTeamLeadDashboard } from '../../api/queries';
import { CardSkeletonGrid, EmptyState, ErrorState } from '../../components/ui/States';
import { StatCard } from '../../components/ui/StatCard';
import { SoftBadge } from '../../components/ui/StatusBadge';
import { useAuth } from '../../auth/AuthContext';
import { palette } from '../../theme/tokens';
import { formatDateTime } from '../../utils/format';
import { labels, packageTone } from '../../utils/status';
import { HorizontalBarChart } from './charts';
import { GreetingHero } from './GreetingHero';
import { QuickInsightChat } from './QuickInsightChat';

/** מסך ראש הצוות: רק האריזות של הצוותים שלו (§10.5). */
export function TeamLeadOverview() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useTeamLeadDashboard();

  if (isLoading) return <CardSkeletonGrid count={4} />;
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const chartData = data.packagesByStatus.map((item) => ({ label: item.label, value: item.count }));

  return (
    <Box>
      <GreetingHero
        name={user?.fullName ?? ''}
        subtitle={
          data.teamNames.length > 0
            ? `מעקב אחר הציוד של ${data.teamNames.join(' · ')}`
            : 'מעקב אחר ציוד הצוות'
        }
        tiles={
          <>
            <StatCard
              value={data.totalPackages}
              label="אריזות הצוות"
              tone="primary"
              icon={<Inventory2RoundedIcon fontSize="small" />}
            />
            <StatCard
              value={data.inTransitPackages}
              label="בדרך"
              tone="info"
              icon={<LocalShippingRoundedIcon fontSize="small" />}
            />
            <StatCard
              value={data.deliveredPackages}
              label="הגיעו לחדר"
              tone="success"
              icon={<CheckCircleRoundedIcon fontSize="small" />}
            />
            <StatCard
              value={data.assetsCount}
              label="מחשבים ומסכים"
              tone="violet"
              icon={<ComputerRoundedIcon fontSize="small" />}
            />
          </>
        }
      />

      <QuickInsightChat
        prompts={[
          { label: 'כמה אריזות בצוות?', answer: `בצוות יש ${data.totalPackages} אריזות.` },
          { label: 'כמה בדרך?', answer: `בדרך כרגע ${data.inTransitPackages} אריזות.` },
          { label: 'כמה הגיעו?', answer: `הגיעו לחדר ${data.deliveredPackages} אריזות.` },
          { label: 'כמה מסכים ומשתמשים?', answer: `יש ${data.assetsCount} פריטי ציוד ברשימה.` },
        ]}
      />

      <Card sx={{ p: 2.5, mb: 3 }}>
        <Typography sx={{ fontSize: 13.5, color: palette.textSecondary }}>
          התקדמות הציוד של הצוות
        </Typography>
        <Stack direction="row" alignItems="baseline" gap={1} sx={{ mt: 0.5 }}>
          <Typography sx={{ fontSize: 32, fontWeight: 800 }}>{data.progressPercent}%</Typography>
          <Typography sx={{ fontSize: 13, color: palette.textSecondary }}>
            מהאריזות כבר בחדר היעד
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={data.progressPercent}
          color="success"
          sx={{ mt: 1.5 }}
          aria-label="התקדמות הצוות"
        />
      </Card>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
        <Card sx={{ p: 2.5 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700 }}>אריזות לפי סטטוס</Typography>
          <Typography sx={{ fontSize: 12.5, color: palette.textSecondary, mb: 1.5 }}>
            איפה נמצא הציוד של הצוות כרגע
          </Typography>
          <HorizontalBarChart data={chartData} height={260} />
        </Card>

        <Card sx={{ p: 2.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700 }}>אריזות אחרונות</Typography>
            <Button component={Link} to="/packages" size="small" startIcon={<SearchRoundedIcon />}>
              חיפוש לפי בעלים
            </Button>
          </Stack>

          {data.recentPackages.length === 0 ? (
            <EmptyState
              title="אין עדיין אריזות לצוות"
              description="ברגע שתיפתח אריזה לציוד של הצוות היא תופיע כאן"
            />
          ) : (
            <Stack divider={<Divider />}>
              {data.recentPackages.map((pkg) => (
                <Stack
                  key={pkg.id}
                  component={Link}
                  to={`/packages/${pkg.id}`}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  gap={1}
                  sx={{ py: 1.25, textDecoration: 'none', color: 'inherit' }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 700 }} dir="ltr" textAlign="start">
                      {pkg.packageNumber}
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }} noWrap>
                      {pkg.sourceRoomName} ← {pkg.destinationRoomName} · {pkg.totalUnits} יחידות
                    </Typography>
                    <Typography sx={{ fontSize: 11.5, color: palette.textSecondary }}>
                      עודכן: {formatDateTime(pkg.sealedAt ?? pkg.createdAt)}
                    </Typography>
                  </Box>
                  <SoftBadge label={labels.package[pkg.status]} tone={packageTone[pkg.status]} />
                </Stack>
              ))}
            </Stack>
          )}
        </Card>
      </Box>
    </Box>
  );
}

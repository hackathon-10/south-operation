import { useState } from 'react';
import {
  Box,
  Card,
  Chip,
  Collapse,
  Divider,
  IconButton,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import { Link } from 'react-router-dom';
import {
  MISSION_STATUS_LABEL,
  type OperationBaseRowDto,
  type OperationHealth,
  type OperationRowDto,
} from '@south/shared';
import { useOperationDashboard } from '../../api/queries';
import { CardSkeletonGrid, EmptyState, ErrorState } from '../../components/ui/States';
import { StatCard } from '../../components/ui/StatCard';
import { useAuth } from '../../auth/AuthContext';
import { palette, tones } from '../../theme/tokens';
import { formatDateTime, formatMinutes } from '../../utils/format';
import { DonutChart, type DonutDatum } from './charts';
import { GreetingHero } from './GreetingHero';
import { QuickInsightChat } from './QuickInsightChat';

/**
 * מסך מפקד המבצע (§10.6) - תמונת מאקרו בלבד.
 *
 * הוא אינו מתעניין בשליחות מסוימת, ולכן אין כאן רשימת אריזות ואין רשימת משימות.
 * שלוש רצועות: האם המבצע בזמנים, מי בבעיה, ומה מחכה להחלטה שלו.
 */

const HEALTH_LABEL: Record<OperationHealth, string> = {
  GREEN: 'תקין',
  AMBER: 'דורש תשומת לב',
  RED: 'תקוע',
};

const HEALTH_TONE: Record<OperationHealth, 'success' | 'warning' | 'danger'> = {
  GREEN: 'success',
  AMBER: 'warning',
  RED: 'danger',
};

function HealthChip({ health }: { health: OperationHealth }) {
  const tone = tones[HEALTH_TONE[health]];
  return (
    <Chip
      size="small"
      label={HEALTH_LABEL[health]}
      sx={{
        bgcolor: tone.soft,
        color: tone.main,
        fontWeight: 700,
        border: `1px solid ${tone.main}33`,
      }}
    />
  );
}

/** סרגל התקדמות אחד, בצבע החיווי - כך שהעין תופסת מצב לפני שהיא קוראת מספר. */
function ProgressBar({ row }: { row: OperationRowDto }) {
  const tone = tones[HEALTH_TONE[row.health]];

  // בלי אריזות אין מה למדוד. סרגל על 0% נקרא ככישלון, ולא בזה מדובר.
  if (row.totalPackages === 0) {
    return (
      <Box sx={{ minWidth: 140 }}>
        <Typography variant="caption" color="text.secondary">
          אין אריזות במעקב
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minWidth: 140 }}>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {row.deliveredPackages}/{row.totalPackages} אריזות
        </Typography>
        <Typography variant="caption" sx={{ fontWeight: 700 }}>
          {row.percentDelivered}%
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={row.percentDelivered}
        sx={{
          height: 8,
          borderRadius: 4,
          bgcolor: palette.slateSoft ?? '#EEF1F5',
          '& .MuiLinearProgress-bar': { bgcolor: tone.main, borderRadius: 4 },
        }}
      />
    </Box>
  );
}

function Reasons({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) return null;
  return (
    <Stack spacing={0.25} sx={{ mt: 0.5 }}>
      {reasons.map((reason) => (
        <Typography key={reason} variant="caption" color="text.secondary">
          • {reason}
        </Typography>
      ))}
    </Stack>
  );
}

/** כרטיס בסיס, נפתח ליחידות הארגוניות שתחתיו. */
function BaseCard({ base }: { base: OperationBaseRowDto }) {
  // בסיס בבעיה נפתח מעצמו - אין טעם להסתיר בדיוק את מה שצריך תשומת לב.
  const [open, setOpen] = useState(base.health !== 'GREEN');

  return (
    <Card sx={{ p: 2 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
      >
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              {base.name}
            </Typography>
            <HealthChip health={base.health} />
            {base.openTasks > 0 && (
              <Typography variant="caption" color="text.secondary">
                {base.openTasks} משימות פתוחות
              </Typography>
            )}
          </Stack>
          <Reasons reasons={base.reasons} />
        </Box>

        <Stack direction="row" spacing={2} alignItems="center">
          <ProgressBar row={base} />
          {base.units.length > 0 && (
            <IconButton
              size="small"
              onClick={() => setOpen((value) => !value)}
              aria-label={open ? `סגירת היחידות של ${base.name}` : `פתיחת היחידות של ${base.name}`}
              aria-expanded={open}
              sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: '.2s' }}
            >
              <ExpandMoreRoundedIcon />
            </IconButton>
          )}
        </Stack>
      </Stack>

      <Collapse in={open} unmountOnExit>
        <Divider sx={{ my: 1.5 }} />
        <Stack spacing={1.5}>
          {base.units.length === 0 ? (
            <Typography variant="caption" color="text.secondary">
              אין יחידות ארגוניות רשומות בבסיס זה.
            </Typography>
          ) : (
            base.units.map((unit) => (
              <Stack
                key={unit.id}
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                alignItems={{ sm: 'center' }}
                justifyContent="space-between"
              >
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {unit.name}
                    </Typography>
                    <HealthChip health={unit.health} />
                  </Stack>
                  <Reasons reasons={unit.reasons} />
                </Box>
                <ProgressBar row={unit} />
              </Stack>
            ))
          )}
        </Stack>
      </Collapse>
    </Card>
  );
}

export function OperationDashboard() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useOperationDashboard();

  if (isLoading) return <CardSkeletonGrid count={4} />;
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const { headline } = data;

  // סדר הצבעים כאן (אפור-מידע-ירוק-כתום-סגול) עבר אימות הפרדה מול עיוורון
  // צבעים מול הרקע הבהיר; כל פלח מוצג גם עם תווית טקסט במקרא, כך שהזהות בין
  // הפלחים לא נשענת על הגוון בלבד.
  const healthCounts = { GREEN: 0, AMBER: 0, RED: 0 } as Record<OperationHealth, number>;
  for (const base of data.bases) healthCounts[base.health] += 1;
  const baseHealthData: DonutDatum[] = (['GREEN', 'AMBER', 'RED'] as const).map((health) => ({
    label: HEALTH_LABEL[health],
    value: healthCounts[health],
    tone: HEALTH_TONE[health],
  }));

  const missionStatusData: DonutDatum[] = [
    { label: MISSION_STATUS_LABEL.PLANNED, value: data.missionsByStatus.planned, tone: 'slate' },
    { label: MISSION_STATUS_LABEL.IN_TRANSIT, value: data.missionsByStatus.inTransit, tone: 'info' },
    { label: MISSION_STATUS_LABEL.COMPLETED, value: data.missionsByStatus.completed, tone: 'success' },
    { label: MISSION_STATUS_LABEL.LOADING, value: data.missionsByStatus.loading, tone: 'warning' },
    { label: MISSION_STATUS_LABEL.UNLOADING, value: data.missionsByStatus.unloading, tone: 'violet' },
  ];

  return (
    <Box>
      <GreetingHero
        name={user?.fullName ?? ''}
        subtitle="תמונת מאקרו של המבצע - כל הבסיסים וכל היחידות"
        tiles={
          <>
            <StatCard
              value={`${headline.overallProgressPercent}%`}
              label="התקדמות כוללת"
              tone="primary"
              icon={<CheckCircleRoundedIcon fontSize="small" />}
            />
            <StatCard
              value={`${headline.packagesDelivered}/${headline.packagesTotal}`}
              label="אריזות שהגיעו ליעד"
              tone="success"
              icon={<Inventory2RoundedIcon fontSize="small" />}
            />
            <StatCard
              value={headline.missionsInTransit}
              label="שליחויות בדרך"
              tone="info"
              icon={<LocalShippingRoundedIcon fontSize="small" />}
            />
            <StatCard
              value={headline.basesAtRisk}
              label="בסיסים תקועים"
              tone={headline.basesAtRisk > 0 ? 'danger' : 'slate'}
              icon={<ReportProblemRoundedIcon fontSize="small" />}
            />
          </>
        }
      />

      <QuickInsightChat
        prompts={[
          { label: 'מה המצב הכולל?', answer: `ההתקדמות הכוללת היא ${headline.overallProgressPercent}% עם ${headline.packagesDelivered}/${headline.packagesTotal} אריזות שהגיעו.` },
          { label: 'כמה שליחויות בדרך?', answer: `בדרך כרגע ${headline.missionsInTransit} שליחויות.` },
          { label: 'כמה בסיסים תקועים?', answer: `יש ${headline.basesAtRisk} בסיסים שמדורשים תשומת לב.` },
          { label: 'מה צריך תשומת לב?', answer: data.bases.some((base) => base.health !== 'GREEN') ? 'יש כמה בסיסים או יחידות עם מצב לא תקין.' : 'המערכת נראית יציבה כרגע.' },
        ]}
      />

      {/* מדדי צי רוחביים - אותם חישובים כמו אצל מפקד הלוגיסטיקה, אבל ברמת המערכת כולה */}
      <Card sx={{ p: 2.5, mt: 3 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          gap={3}
          divider={<Divider orientation="vertical" flexItem />}
        >
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 13.5, color: palette.textSecondary }}>
              ציוד שנארז מתוך המיפוי, בכל המערכת
            </Typography>
            <Stack direction="row" alignItems="baseline" gap={1} sx={{ mt: 0.5 }}>
              <Typography sx={{ fontSize: 32, fontWeight: 800 }}>
                {headline.equipmentPackedPercent}%
              </Typography>
              <Typography sx={{ fontSize: 13, color: palette.textSecondary }}>הערכה</Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={headline.equipmentPackedPercent}
              color="success"
              sx={{ mt: 1.5 }}
              aria-label="אחוז ציוד שנארז, בכל המערכת"
            />
          </Box>

          <Stack sx={{ flex: 1 }} gap={1}>
            <MetricLine
              icon={<TimerRoundedIcon fontSize="small" />}
              label="זמן ממוצע מפתיחת משימה עד סגירת אריזה"
              value={formatMinutes(headline.averageTaskToSealMinutes)}
            />
            <MetricLine
              icon={<TimerRoundedIcon fontSize="small" />}
              label="המתנה ממוצעת מאריזה מוכנה עד יציאה"
              value={formatMinutes(headline.averageReadyToDepartMinutes)}
            />
            <MetricLine
              icon={<RouteRoundedIcon fontSize="small" />}
              label="נסיעות שנחסכו באיחוד בסיסים (הערכה)"
              value={`${headline.estimatedTripsSaved}`}
            />
          </Stack>
        </Stack>
      </Card>

      {/* תמונת מאקרו ויזואלית: בריאות הבסיסים וצי השליחויות */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
          mt: 2,
        }}
      >
        <Card sx={{ p: 2.5 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700 }}>בריאות הבסיסים</Typography>
          <Typography sx={{ fontSize: 12.5, color: palette.textSecondary, mb: 1.5 }}>
            כמה בסיסים במצב תקין, דורשים תשומת לב או תקועים
          </Typography>
          <DonutChart data={baseHealthData} centerLabel="בסיסים" />
        </Card>

        <Card sx={{ p: 2.5 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700 }}>צי השליחויות</Typography>
          <Typography sx={{ fontSize: 12.5, color: palette.textSecondary, mb: 1.5 }}>
            כמה שליחויות בכל שלב, בכל המערכת
          </Typography>
          <DonutChart data={missionStatusData} centerLabel="שליחויות" />
        </Card>
      </Box>

      <Stack spacing={2} sx={{ mt: 3 }}>
        <Stack direction="row" alignItems="baseline" justifyContent="space-between">
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            מצב הבסיסים והיחידות
          </Typography>
          <Typography variant="caption" color="text.secondary">
            עודכן {formatDateTime(data.generatedAt)}
          </Typography>
        </Stack>

        {data.bases.map((base) => (
          <BaseCard key={base.id} base={base} />
        ))}
      </Stack>

      <Card sx={{ p: 2, mt: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
          ממתין להחלטתך
        </Typography>
        {data.pendingJoinRequests.length === 0 ? (
          <EmptyState title="אין בקשות ממתינות" description="כל בקשות ההצטרפות טופלו." />
        ) : (
          <Stack spacing={1} divider={<Divider />}>
            {data.pendingJoinRequests.map((request) => (
              <Stack
                key={request.id}
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                component={Link}
                to="/join-requests"
                sx={{ textDecoration: 'none', color: 'inherit', py: 0.5 }}
              >
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {request.requestingUserName} · {request.baseName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    לשליחות {request.missionNumber}
                  </Typography>
                </Box>
                <Typography variant="caption" color="primary" sx={{ fontWeight: 700 }}>
                  לטיפול ‹
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </Card>
    </Box>
  );
}

function MetricLine({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Stack direction="row" alignItems="center" gap={1}>
      <Box sx={{ color: palette.textSecondary, display: 'flex' }} aria-hidden="true">
        {icon}
      </Box>
      <Typography sx={{ fontSize: 12.5, color: palette.textSecondary, flex: 1 }}>{label}</Typography>
      <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{value}</Typography>
    </Stack>
  );
}

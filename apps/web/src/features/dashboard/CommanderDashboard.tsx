import { Box, Button, Card, Divider, LinearProgress, Stack, Typography } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import PendingActionsRoundedIcon from '@mui/icons-material/PendingActionsRounded';
import PriorityHighRoundedIcon from '@mui/icons-material/PriorityHighRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import { Link, useNavigate } from 'react-router-dom';
import { useCommanderDashboard } from '../../api/queries';
import { CardSkeletonGrid, ErrorState } from '../../components/ui/States';
import { StatCard } from '../../components/ui/StatCard';
import { SoftBadge } from '../../components/ui/StatusBadge';
import { useAuth } from '../../auth/AuthContext';
import { palette, tones } from '../../theme/tokens';
import { formatDateTime, formatMinutes, formatRelative } from '../../utils/format';
import { labels, priorityTone } from '../../utils/status';
import { HorizontalBarChart } from './charts';
import { GreetingHero } from './GreetingHero';

/** תמונת מצב מלאה למפקד הלוגיסטיקה (§10.3, §15). */
export function CommanderDashboard() {
  const { user } = useAuth();
  const { data, isLoading, error, refetch } = useCommanderDashboard();
  const navigate = useNavigate();

  if (isLoading) return <CardSkeletonGrid count={6} />;
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const baseChartData = data.baseProgress.map((base) => ({
    label: base.baseName,
    value: base.percentDelivered,
  }));

  const statusChartData = data.packages.byStatus.map((item) => ({
    label: item.label,
    value: item.count,
  }));

  return (
    <Box>
      <GreetingHero
        name={user?.fullName ?? ''}
        subtitle="תמונת מצב מלאה של מבצע דרומה"
        tiles={
          <>
            <StatCard
              value={data.tasks.inProgress + data.tasks.assigned}
              label="משימות פתוחות"
              tone="warning"
              icon={<PendingActionsRoundedIcon fontSize="small" />}
              onClick={() => navigate('/tasks')}
            />
            <StatCard
              value={data.packages.readyWaiting}
              label="אריזות מוכנות לשילוח"
              tone="primary"
              icon={<Inventory2RoundedIcon fontSize="small" />}
              onClick={() => navigate('/packages?status=READY_FOR_SHIPMENT')}
            />
            <StatCard
              value={data.packages.inTransit}
              label="אריזות בדרך"
              tone="info"
              icon={<LocalShippingRoundedIcon fontSize="small" />}
              onClick={() => navigate('/missions')}
            />
            <StatCard
              value={data.tasks.completed}
              label="משימות שהושלמו"
              tone="success"
              icon={<AssignmentTurnedInRoundedIcon fontSize="small" />}
            />
          </>
        }
      />

      <Stack direction="row" gap={1.5} sx={{ mb: 3, flexWrap: 'wrap' }}>
        <Button
          component={Link}
          to="/tasks/new"
          variant="contained"
          size="large"
          startIcon={<AddRoundedIcon />}
        >
          משימת אריזה חדשה
        </Button>
        <Button
          component={Link}
          to="/missions/new"
          variant="outlined"
          size="large"
          startIcon={<RouteRoundedIcon />}
        >
          תכנון שליחות
        </Button>
        {data.pendingJoinRequests.length > 0 && (
          <Button
            component={Link}
            to="/join-requests"
            size="large"
            color="warning"
            variant="outlined"
          >
            {data.pendingJoinRequests.length} בקשות ממתינות לאישור
          </Button>
        )}
      </Stack>

      {/* התקדמות כללית */}
      <Card sx={{ p: 2.5, mb: 3 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          gap={3}
          divider={<Divider orientation="vertical" flexItem />}
        >
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 13.5, color: palette.textSecondary }}>
              התקדמות המעבר (אריזות שהגיעו לחדר היעד)
            </Typography>
            <Stack direction="row" alignItems="baseline" gap={1} sx={{ mt: 0.5 }}>
              <Typography sx={{ fontSize: 32, fontWeight: 800 }}>
                {data.overallProgressPercent}%
              </Typography>
              <Typography sx={{ fontSize: 13, color: palette.textSecondary }}>
                {data.packages.total} אריזות במערכת
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={data.overallProgressPercent}
              sx={{ mt: 1.5 }}
              aria-label="התקדמות כללית"
            />
          </Box>

          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 13.5, color: palette.textSecondary }}>
              ציוד שנארז מתוך המיפוי
            </Typography>
            <Stack direction="row" alignItems="baseline" gap={1} sx={{ mt: 0.5 }}>
              <Typography sx={{ fontSize: 32, fontWeight: 800 }}>
                {data.equipmentPackedPercent}%
              </Typography>
              <Typography sx={{ fontSize: 13, color: palette.textSecondary }}>הערכה</Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={data.equipmentPackedPercent}
              color="success"
              sx={{ mt: 1.5 }}
              aria-label="אחוז ציוד שנארז"
            />
          </Box>

          <Stack sx={{ flex: 1 }} gap={1}>
            <MetricLine
              icon={<TimerRoundedIcon fontSize="small" />}
              label="זמן ממוצע מפתיחת משימה עד סגירת אריזה"
              value={formatMinutes(data.averageTaskToSealMinutes)}
            />
            <MetricLine
              icon={<TimerRoundedIcon fontSize="small" />}
              label="המתנה ממוצעת מאריזה מוכנה עד יציאה"
              value={formatMinutes(data.averageReadyToDepartMinutes)}
            />
            <MetricLine
              icon={<RouteRoundedIcon fontSize="small" />}
              label="נסיעות שנחסכו באיחוד בסיסים (הערכה)"
              value={`${data.estimatedTripsSaved}`}
            />
          </Stack>
        </Stack>
      </Card>

      {/* גרפים */}
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
          mb: 3,
        }}
      >
        <Card sx={{ p: 2.5 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700 }}>התקדמות לפי בסיס</Typography>
          <Typography sx={{ fontSize: 12.5, color: palette.textSecondary, mb: 1.5 }}>
            אחוז האריזות שהגיעו לחדר היעד מכל בסיס
          </Typography>
          <HorizontalBarChart data={baseChartData} suffix="%" />
        </Card>

        <Card sx={{ p: 2.5 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700 }}>אריזות לפי סטטוס</Typography>
          <Typography sx={{ fontSize: 12.5, color: palette.textSecondary, mb: 1.5 }}>
            כמה אריזות נמצאות בכל שלב בשרשרת
          </Typography>
          <HorizontalBarChart data={statusChartData} height={280} />
        </Card>
      </Box>

      {/* משימות דחופות ושליחות קרובה */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' } }}>
        <Card sx={{ p: 2.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700 }}>משימות דחופות</Typography>
            <Button component={Link} to="/tasks" size="small">
              לכל המשימות
            </Button>
          </Stack>

          {data.urgentTasks.length === 0 ? (
            <Typography sx={{ fontSize: 13.5, color: palette.textSecondary, py: 2 }}>
              אין כרגע משימות דחופות פתוחות
            </Typography>
          ) : (
            <Stack divider={<Divider />}>
              {data.urgentTasks.map((task) => (
                <Stack
                  key={task.id}
                  component={Link}
                  to={`/tasks/${task.id}`}
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  gap={1.5}
                  sx={{ py: 1.25, textDecoration: 'none', color: 'inherit' }}
                >
                  <Stack direction="row" alignItems="center" gap={1.5} sx={{ minWidth: 0 }}>
                    <Box
                      sx={{
                        width: 34,
                        height: 34,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        backgroundColor: tones[priorityTone[task.priority]].soft,
                        color: tones[priorityTone[task.priority]].main,
                        flexShrink: 0,
                      }}
                      aria-hidden="true"
                    >
                      <PriorityHighRoundedIcon fontSize="small" />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 700 }} noWrap>
                        {task.taskNumber} · {task.sourceRoomName}
                      </Typography>
                      <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }} noWrap>
                        {task.sourceBaseName} ← {task.destinationRoomName} · {task.assignedSoldierName}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack alignItems="flex-end" gap={0.5}>
                    <SoftBadge label={labels.priority[task.priority]} tone={priorityTone[task.priority]} />
                    <Typography sx={{ fontSize: 11.5, color: palette.textSecondary }}>
                      {task.progress.percent}% נארז
                    </Typography>
                  </Stack>
                </Stack>
              ))}
            </Stack>
          )}
        </Card>

        <Card sx={{ p: 2.5 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700, mb: 1.5 }}>השליחות הקרובה</Typography>
          {data.nextMission ? (
            <Stack gap={1}>
              <Typography sx={{ fontSize: 15, fontWeight: 800 }} dir="ltr" textAlign="start">
                {data.nextMission.missionNumber}
              </Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                {data.nextMission.title}
              </Typography>
              <Typography sx={{ fontSize: 13, color: palette.textSecondary }}>
                יציאה מתוכננת: {formatDateTime(data.nextMission.plannedDepartureAt)} (
                {formatRelative(data.nextMission.plannedDepartureAt)})
              </Typography>
              <Typography sx={{ fontSize: 13, color: palette.textSecondary }}>
                {data.nextMission.packageCount} אריזות · {data.nextMission.stopCount} עצירות
              </Typography>
              {data.nextMission.pickupBaseNames.length > 0 && (
                <Typography sx={{ fontSize: 13 }}>
                  איסוף: {data.nextMission.pickupBaseNames.join(' · ')}
                </Typography>
              )}
              <Button
                component={Link}
                to={`/missions/${data.nextMission.id}`}
                variant="contained"
                sx={{ mt: 1 }}
              >
                פרטי השליחות
              </Button>
            </Stack>
          ) : (
            <Stack gap={1.5}>
              <Typography sx={{ fontSize: 13.5, color: palette.textSecondary }}>
                אין שליחות מתוכננת כרגע
              </Typography>
              <Button component={Link} to="/missions/new" variant="contained">
                תכנון שליחות
              </Button>
            </Stack>
          )}
        </Card>
      </Box>
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

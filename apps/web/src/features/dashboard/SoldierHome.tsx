import { Box, Button, Card, Divider, LinearProgress, Stack, Typography } from '@mui/material';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import QrCodeScannerRoundedIcon from '@mui/icons-material/QrCodeScannerRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { Link, useNavigate } from 'react-router-dom';
import { useSoldierDashboard } from '../../api/queries';
import { CardSkeletonGrid, EmptyState, ErrorState } from '../../components/ui/States';
import { StatCard } from '../../components/ui/StatCard';
import { SoftBadge } from '../../components/ui/StatusBadge';
import { useAuth } from '../../auth/AuthContext';
import { palette, tones } from '../../theme/tokens';
import { formatDateTime, formatRelative } from '../../utils/format';
import { labels, missionTone, packageTone, priorityTone } from '../../utils/status';
import { GreetingHero } from './GreetingHero';
import { QuickInsightChat } from './QuickInsightChat';

/** "הבית שלי" של חייל הלוגיסטיקה - המשימה הבאה ופעולה אחת ברורה (§10.4). */
export function SoldierHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useSoldierDashboard();

  if (isLoading) return <CardSkeletonGrid count={4} />;
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const nextTask = data.nextTask;

  return (
    <Box>
      <GreetingHero
        name={user?.fullName ?? ''}
        subtitle="המשימות והשליחויות שלך במקום אחד"
        tiles={
          <>
            <StatCard
              value={data.activeTasks.length}
              label="משימות פעילות"
              tone="warning"
              icon={<AssignmentRoundedIcon fontSize="small" />}
              onClick={() => navigate('/tasks')}
            />
            <StatCard
              value={data.openPackages.length}
              label="אריזות פתוחות"
              tone="primary"
              icon={<Inventory2RoundedIcon fontSize="small" />}
            />
            <StatCard
              value={data.readyPackages}
              label="מוכנות לשילוח"
              tone="violet"
              icon={<LocalShippingRoundedIcon fontSize="small" />}
            />
            <StatCard
              value={data.completedTodayCount}
              label="הושלמו היום"
              tone="success"
              icon={<CheckCircleRoundedIcon fontSize="small" />}
            />
          </>
        }
      />

      <QuickInsightChat
        prompts={[
          { label: 'מה המשימה הבאה?', answer: nextTask ? `המשימה הבאה היא ${nextTask.sourceRoomName} → ${nextTask.destinationRoomName}.` : 'אין כרגע משימה פעילה.' },
          { label: 'כמה אריזות פתוחות?', answer: `יש ${data.openPackages.length} אריזות פתוחות.` },
          { label: 'כמה הושלמו היום?', answer: `הושלמו היום ${data.completedTodayCount} משימות.` },
          { label: 'האם יש שליחויות?', answer: data.myMissions.length > 0 ? `יש ${data.myMissions.length} שליחויות משויכות אליך.` : 'אין שליחויות משויכות כרגע.' },
        ]}
      />

      {/* המשימה הבאה - הפעולה הראשית במסך */}
      {nextTask ? (
        <Card sx={{ p: 2.5, mb: 3, borderColor: tones.primary.main }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            <Typography sx={{ fontSize: 13, fontWeight: 700, color: tones.primary.main }}>
              המשימה הבאה שלך
            </Typography>
            <SoftBadge label={labels.priority[nextTask.priority]} tone={priorityTone[nextTask.priority]} />
          </Stack>

          <Typography sx={{ fontSize: 20, fontWeight: 800, mt: 1 }}>
            {nextTask.sourceRoomName}
          </Typography>
          <Typography sx={{ fontSize: 14, color: palette.textSecondary }}>
            {nextTask.sourceBaseName} ← {nextTask.destinationRoomName}
          </Typography>

          <Stack direction="row" alignItems="center" gap={1.5} sx={{ mt: 2 }}>
            <Box sx={{ flex: 1 }}>
              <LinearProgress
                variant="determinate"
                value={nextTask.progress.percent}
                aria-label="התקדמות אריזה"
              />
            </Box>
            <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
              {nextTask.progress.packedUnits}/{nextTask.progress.totalUnits} פריטים
            </Typography>
          </Stack>

          {nextTask.dueAt && (
            <Typography sx={{ fontSize: 12.5, color: palette.textSecondary, mt: 1 }}>
              יעד לביצוע: {formatDateTime(nextTask.dueAt)} ({formatRelative(nextTask.dueAt)})
            </Typography>
          )}

          <Button
            component={Link}
            to={`/tasks/${nextTask.id}`}
            variant="contained"
            size="large"
            fullWidth
            startIcon={<PlayArrowRoundedIcon />}
            sx={{ mt: 2 }}
          >
            {nextTask.status === 'ASSIGNED' ? 'התחלת משימה' : 'המשך אריזה'}
          </Button>
        </Card>
      ) : (
        <Box sx={{ mb: 3 }}>
          <EmptyState
            title="אין משימות פתוחות"
            description="כל המשימות שלך הושלמו. אפשר לסרוק אריזה או לבדוק שליחויות מתוכננות"
            action={
              <Button component={Link} to="/scan" variant="contained" startIcon={<QrCodeScannerRoundedIcon />}>
                סריקת אריזה
              </Button>
            }
          />
        </Box>
      )}

      <Button
        component={Link}
        to="/scan"
        variant="outlined"
        size="large"
        fullWidth
        startIcon={<QrCodeScannerRoundedIcon />}
        sx={{ mb: 3 }}
      >
        סריקת QR של אריזה
      </Button>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
        <Card sx={{ p: 2.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700 }}>המשימות שלי</Typography>
            <Button component={Link} to="/tasks" size="small">
              הכול
            </Button>
          </Stack>
          {data.activeTasks.length === 0 ? (
            <Typography sx={{ fontSize: 13.5, color: palette.textSecondary, py: 2 }}>
              אין משימות פעילות
            </Typography>
          ) : (
            <Stack divider={<Divider />}>
              {data.activeTasks.slice(0, 5).map((task) => (
                <Stack
                  key={task.id}
                  component={Link}
                  to={`/tasks/${task.id}`}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ py: 1.25, textDecoration: 'none', color: 'inherit' }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 700 }} noWrap>
                      {task.sourceRoomName}
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }} noWrap>
                      {task.taskNumber} · {task.progress.percent}% נארז
                    </Typography>
                  </Box>
                  <SoftBadge label={labels.task[task.status]} tone={task.status === 'IN_PROGRESS' ? 'info' : 'slate'} />
                </Stack>
              ))}
            </Stack>
          )}
        </Card>

        <Card sx={{ p: 2.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700 }}>השליחויות שלי</Typography>
            <Button component={Link} to="/missions" size="small">
              הכול
            </Button>
          </Stack>
          {data.myMissions.length === 0 ? (
            <Typography sx={{ fontSize: 13.5, color: palette.textSecondary, py: 2 }}>
              אין שליחויות משויכות אליך
            </Typography>
          ) : (
            <Stack divider={<Divider />}>
              {data.myMissions.map((mission) => (
                <Stack
                  key={mission.id}
                  component={Link}
                  to={`/missions/${mission.id}`}
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ py: 1.25, textDecoration: 'none', color: 'inherit' }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 700 }} noWrap>
                      {mission.title}
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }} noWrap>
                      {mission.missionNumber} · {mission.packageCount} אריזות ·{' '}
                      {formatRelative(mission.plannedDepartureAt)}
                    </Typography>
                  </Box>
                  <SoftBadge label={labels.mission[mission.status]} tone={missionTone[mission.status]} />
                </Stack>
              ))}
            </Stack>
          )}
        </Card>
      </Box>

      {data.openPackages.length > 0 && (
        <Card sx={{ p: 2.5, mt: 2 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700, mb: 1 }}>אריזות פתוחות</Typography>
          <Stack divider={<Divider />}>
            {data.openPackages.map((pkg) => (
              <Stack
                key={pkg.id}
                component={Link}
                to={`/packages/${pkg.id}`}
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ py: 1.25, textDecoration: 'none', color: 'inherit' }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 700 }} dir="ltr" textAlign="start">
                    {pkg.packageNumber}
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }} noWrap>
                    {pkg.sourceRoomName} ← {pkg.destinationRoomName} · {pkg.totalUnits} יחידות
                  </Typography>
                </Box>
                <SoftBadge label={labels.package[pkg.status]} tone={packageTone[pkg.status]} />
              </Stack>
            ))}
          </Stack>
        </Card>
      )}
    </Box>
  );
}

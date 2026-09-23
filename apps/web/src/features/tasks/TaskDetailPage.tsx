import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Divider,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddBoxRoundedIcon from '@mui/icons-material/AddBoxRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import ComputerRoundedIcon from '@mui/icons-material/ComputerRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import { useNavigate, useParams } from 'react-router-dom';
import { PACKAGE_TYPES, PACKAGE_TYPE_LABEL, UserRole } from '@south/shared';
import {
  useCancelTask,
  useCreatePackage,
  useResponsibleCandidates,
  useStartTask,
  useTask,
} from '../../api/queries';
import { useAuth } from '../../auth/AuthContext';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { PageHeader } from '../../components/ui/PageHeader';
import { SoftBadge, StatusBadge } from '../../components/ui/StatusBadge';
import { ErrorState, ListSkeleton } from '../../components/ui/States';
import { toUserError } from '../../api/errors';
import { palette, tones } from '../../theme/tokens';
import { formatDateTime, formatDestination } from '../../utils/format';
import { labels, packageTone, priorityTone, taskTone } from '../../utils/status';

/** פרטי משימת אריזה: מה בדיוק צריך לארוז, כמה נארז, ואילו אריזות נפתחו. */
export function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: task, isLoading, error, refetch } = useTask(taskId);

  const startTask = useStartTask();
  const cancelTask = useCancelTask();
  const createPackage = useCreatePackage();
  const { data: candidates } = useResponsibleCandidates(taskId);

  const [packageType, setPackageType] = useState<string>('PROFESSIONAL_BOX');
  // האחראי על האריזה. ברירת המחדל היא המשתמש שפותח אותה, אבל אפשר להעביר
  // את האחריות לאדם אחר - למשל ראש הצוות שהציוד שייך אליו.
  const [responsibleUserId, setResponsibleUserId] = useState<string>('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) return <ListSkeleton rows={6} />;
  if (error || !task) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const isCommander = user?.role === UserRole.LOGISTICS_COMMANDER;
  const isAssignedSoldier = user?.id === task.assignedSoldierId;
  const canPack = isAssignedSoldier && task.status !== 'COMPLETED' && task.status !== 'CANCELLED';

  const responsibleOptions = candidates ?? [];
  // ברירת המחדל היא המשתמש המחובר, כל עוד לא נבחר אחר במפורש.
  const selectedResponsibleId =
    responsibleUserId ||
    (responsibleOptions.some((option) => option.id === user?.id) ? (user?.id ?? '') : '');

  const runAction = async (action: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await action();
    } catch (actionFailure) {
      const details = toUserError(actionFailure);
      setActionError(details.hint ? `${details.message}. ${details.hint}` : details.message);
    }
  };

  return (
    <Box>
      <PageHeader
        title={`משימה ${task.taskNumber}`}
        subtitle={`${task.sourceBaseName} · ${task.sourceRoomName} ← ${task.destinationRoomName}`}
        icon={<Inventory2RoundedIcon />}
        action={
          canPack ? (
            task.status === 'ASSIGNED' ? (
              <Button
                variant="contained"
                size="large"
                startIcon={<PlayArrowRoundedIcon />}
                onClick={() => runAction(() => startTask.mutateAsync(task.id))}
                disabled={startTask.isPending}
                fullWidth
              >
                התחלת משימה
              </Button>
            ) : undefined
          ) : undefined
        }
      />

      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      {/* סיכום */}
      <Card sx={{ p: 2.5, mb: 2.5 }}>
        <Stack direction="row" gap={1} sx={{ flexWrap: 'wrap', mb: 2 }}>
          <StatusBadge label={labels.task[task.status]} tone={taskTone[task.status]} />
          <SoftBadge label={`דחיפות: ${labels.priority[task.priority]}`} tone={priorityTone[task.priority]} />
          <Chip size="small" label={`צוות: ${task.teamName}`} />
          <Chip size="small" label={`מבצע: ${task.assignedSoldierName}`} />
        </Stack>

        <Stack direction="row" alignItems="center" gap={2}>
          <Box sx={{ flex: 1 }}>
            <LinearProgress
              variant="determinate"
              value={task.progress.percent}
              aria-label="התקדמות האריזה"
            />
          </Box>
          <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
            {task.progress.packedUnits}/{task.progress.totalUnits} יחידות · {task.progress.percent}%
          </Typography>
        </Stack>

        <Divider sx={{ my: 2 }} />

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
            gap: 1.5,
          }}
        >
          <Detail label="חדר מקור" value={`${task.sourceBaseName} · ${task.sourceRoomName}`} />
          <Detail label="חדר יעד" value={formatDestination(task.destinationRoomDetails)} />
          <Detail label="נוצרה על ידי" value={task.createdByName} />
          <Detail label="נוצרה בתאריך" value={formatDateTime(task.createdAt)} />
          <Detail label="יעד לביצוע" value={formatDateTime(task.dueAt)} />
          <Detail label="הושלמה" value={formatDateTime(task.completedAt)} />
        </Box>

        {task.notes && (
          <Alert severity="info" sx={{ mt: 2 }}>
            {task.notes}
          </Alert>
        )}

        {isCommander && task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && (
          <Button
            color="error"
            startIcon={<CancelRoundedIcon />}
            sx={{ mt: 2 }}
            onClick={() => setCancelOpen(true)}
          >
            ביטול משימה
          </Button>
        )}
      </Card>

      {/* תכולת המשימה */}
      <Card sx={{ p: 2.5, mb: 2.5 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 1.5 }}>מה צריך לארוז</Typography>

        <Stack divider={<Divider />}>
          {task.lines.map((line) => {
            const done = line.remainingQuantity === 0;
            return (
              <Stack
                key={line.id}
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={1.5}
                sx={{ py: 1.25 }}
              >
                <Stack direction="row" alignItems="center" gap={1.5} sx={{ minWidth: 0 }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 2,
                      display: 'grid',
                      placeItems: 'center',
                      backgroundColor: done ? tones.success.soft : palette.slateSoft,
                      color: done ? tones.success.main : palette.textSecondary,
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  >
                    {line.trackingMode === 'SERIALIZED' ? (
                      <ComputerRoundedIcon fontSize="small" />
                    ) : (
                      <Inventory2RoundedIcon fontSize="small" />
                    )}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 700 }} noWrap>
                      {line.productName}
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }} noWrap>
                      {line.trackingMode === 'SERIALIZED'
                        ? `מזהה ${line.assetTag} · בעלים: ${line.ownerName}`
                        : `מק״ט ${line.sku}`}
                    </Typography>
                  </Box>
                </Stack>

                <Stack alignItems="flex-end">
                  <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
                    {line.packedQuantity}/{line.requestedQuantity}
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: 11.5,
                      color: done ? tones.success.main : palette.textSecondary,
                      fontWeight: 600,
                    }}
                  >
                    {done ? 'נארז' : `נותרו ${line.remainingQuantity}`}
                  </Typography>
                </Stack>
              </Stack>
            );
          })}
        </Stack>
      </Card>

      {/* אריזות */}
      <Card sx={{ p: 2.5 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
          gap={1.5}
          sx={{ mb: 1.5 }}
        >
          <Typography sx={{ fontSize: 16, fontWeight: 700 }}>
            אריזות במשימה ({task.packages.length})
          </Typography>

          {canPack && (
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              gap={1}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              <TextField
                select
                size="small"
                label="סוג אריזה"
                value={packageType}
                onChange={(event) => setPackageType(event.target.value)}
                sx={{ minWidth: { xs: 0, sm: 150 } }}
              >
                {PACKAGE_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    {PACKAGE_TYPE_LABEL[type]}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="אחראי על האריזה"
                value={selectedResponsibleId}
                onChange={(event) => setResponsibleUserId(event.target.value)}
                sx={{ minWidth: { xs: 0, sm: 190 } }}
              >
                {responsibleOptions.map((option) => (
                  <MenuItem key={option.id} value={option.id}>
                    {option.fullName}
                  </MenuItem>
                ))}
              </TextField>
              <Button
                variant="contained"
                startIcon={<AddBoxRoundedIcon />}
                disabled={createPackage.isPending || !selectedResponsibleId}
                onClick={() =>
                  runAction(async () => {
                    const created = await createPackage.mutateAsync({
                      taskId: task.id,
                      packageType,
                      responsibleUserId: selectedResponsibleId,
                    });
                    navigate(`/packages/${created.id}`);
                  })
                }
              >
                אריזה חדשה
              </Button>
            </Stack>
          )}
        </Stack>

        {task.packages.length === 0 ? (
          <Typography sx={{ fontSize: 13.5, color: palette.textSecondary, py: 2 }}>
            עדיין לא נפתחה אריזה במשימה הזו
          </Typography>
        ) : (
          <Stack divider={<Divider />}>
            {task.packages.map((pkg) => (
              <Stack
                key={pkg.id}
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={1}
                onClick={() => navigate(`/packages/${pkg.id}`)}
                sx={{ py: 1.25, cursor: 'pointer' }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 700 }} dir="ltr" textAlign="start">
                    {pkg.packageNumber}
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }} noWrap>
                    {pkg.itemLineCount} שורות · {pkg.totalUnits} יחידות
                    {pkg.missionNumber ? ` · שליחות ${pkg.missionNumber}` : ''}
                  </Typography>
                </Box>
                <SoftBadge label={labels.package[pkg.status]} tone={packageTone[pkg.status]} />
              </Stack>
            ))}
          </Stack>
        )}
      </Card>

      <ConfirmDialog
        open={cancelOpen}
        title="ביטול משימת האריזה"
        description="הביטול משחרר את הציוד שטרם נארז. אם יש אריזות עם תכולה, צריך לרוקן אותן קודם."
        confirmLabel="ביטול המשימה"
        cancelLabel="חזרה"
        tone="error"
        loading={cancelTask.isPending}
        onClose={() => setCancelOpen(false)}
        onConfirm={() =>
          runAction(async () => {
            await cancelTask.mutateAsync({ taskId: task.id });
            setCancelOpen(false);
          })
        }
      />
    </Box>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 12, color: palette.textSecondary }}>{label}</Typography>
      <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{value}</Typography>
    </Box>
  );
}

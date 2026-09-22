import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded';
import QrCodeScannerRoundedIcon from '@mui/icons-material/QrCodeScannerRounded';
import GroupAddRoundedIcon from '@mui/icons-material/GroupAddRounded';
import { Link, useParams } from 'react-router-dom';
import { UserRole } from '@south/shared';
import {
  useArriveAtStop,
  useCreateJoinRequest,
  useLoadMissionPackage,
  useMission,
  useMissionAction,
  usePackages,
  useReorderStops,
  useUnloadMissionPackage,
} from '../../api/queries';
import { toUserError } from '../../api/errors';
import { useAuth } from '../../auth/AuthContext';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { PageHeader } from '../../components/ui/PageHeader';
import { SoftBadge, StatusBadge } from '../../components/ui/StatusBadge';
import { ErrorState, ListSkeleton } from '../../components/ui/States';
import { palette, tones } from '../../theme/tokens';
import { formatDateTime, formatKm, formatMinutes } from '../../utils/format';
import { labels, missionTone, packageTone } from '../../utils/status';
import { StopSortableList } from './StopSortableList';

/** מסך ניהול וביצוע השליחות (§8.6 - §8.9). */
export function MissionDetailPage() {
  const { missionId } = useParams<{ missionId: string }>();
  const { user } = useAuth();
  const { data: mission, isLoading, error, refetch } = useMission(missionId);

  const startLoading = useMissionAction('start-loading');
  const depart = useMissionAction('depart');
  const startUnloading = useMissionAction('start-unloading');
  const complete = useMissionAction('complete');
  const arrive = useArriveAtStop();
  const loadPackage = useLoadMissionPackage();
  const unloadPackage = useUnloadMissionPackage();
  const reorderStops = useReorderStops();
  const createJoinRequest = useCreateJoinRequest();

  const [actionError, setActionError] = useState<string | null>(null);
  const [departOpen, setDepartOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinSelection, setJoinSelection] = useState<Set<string>>(new Set());
  const [joinNote, setJoinNote] = useState('');

  const { data: myBasePackages } = usePackages(
    { availableForMission: true, baseId: user?.baseId ?? undefined, pageSize: 50 },
    Boolean(joinOpen && user?.baseId),
  );

  if (isLoading) return <ListSkeleton rows={6} />;
  if (error || !mission) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const isCommander = user?.role === UserRole.LOGISTICS_COMMANDER;

  const run = async (action: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await action();
    } catch (failure) {
      const details = toUserError(failure);
      setActionError(details.hint ? `${details.message}. ${details.hint}` : details.message);
    }
  };

  const primaryAction = (() => {
    if (mission.permissions.canStartLoading) {
      return (
        <Button
          variant="contained"
          size="large"
          startIcon={<PlayArrowRoundedIcon />}
          onClick={() => run(() => startLoading.mutateAsync(mission.id))}
          fullWidth
        >
          תחילת העמסה
        </Button>
      );
    }
    if (mission.permissions.canDepart) {
      return (
        <Button
          variant="contained"
          size="large"
          startIcon={<LocalShippingRoundedIcon />}
          onClick={() => setDepartOpen(true)}
          fullWidth
        >
          יציאה לדרך
        </Button>
      );
    }
    if (mission.permissions.canUnload) {
      return (
        <Button
          variant="contained"
          size="large"
          startIcon={<PlaceRoundedIcon />}
          onClick={() => run(() => startUnloading.mutateAsync(mission.id))}
          fullWidth
        >
          הגענו לקריית התקשוב - תחילת פריקה
        </Button>
      );
    }
    if (mission.permissions.canComplete) {
      return (
        <Button
          variant="contained"
          size="large"
          color="success"
          startIcon={<DoneAllRoundedIcon />}
          onClick={() => run(() => complete.mutateAsync(mission.id))}
          fullWidth
        >
          סיום השליחות
        </Button>
      );
    }
    if (mission.permissions.canRequestJoin) {
      return (
        <Button
          variant="contained"
          size="large"
          startIcon={<GroupAddRoundedIcon />}
          onClick={() => setJoinOpen(true)}
          fullWidth
        >
          בקשה להוספת איסוף
        </Button>
      );
    }
    return undefined;
  })();

  return (
    <Box>
      <PageHeader
        title={`שליחות ${mission.missionNumber}`}
        subtitle={mission.title}
        icon={<LocalShippingRoundedIcon />}
        action={primaryAction}
      />

      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      <Card sx={{ p: 2.5, mb: 2.5 }}>
        <Stack direction="row" gap={1} sx={{ flexWrap: 'wrap', mb: 2 }}>
          <StatusBadge label={labels.mission[mission.status]} tone={missionTone[mission.status]} />
          {mission.requiresSecuredTransport && (
            <SoftBadge
              label="נסיעה מאובטחת"
              tone="warning"
              icon={<ShieldRoundedIcon sx={{ fontSize: 14 }} />}
            />
          )}
          <Chip size="small" label={`${mission.packageCount} אריזות`} />
          <Chip size="small" label={`${mission.stopCount} עצירות`} />
          {mission.pendingJoinRequestCount > 0 && (
            <Chip
              size="small"
              color="warning"
              component={Link}
              to="/join-requests"
              clickable
              label={`${mission.pendingJoinRequestCount} בקשות ממתינות`}
            />
          )}
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
            gap: 1.5,
          }}
        >
          <Detail label="יציאה מתוכננת" value={formatDateTime(mission.plannedDepartureAt)} />
          <Detail label="יציאה בפועל" value={formatDateTime(mission.actualDepartureAt)} />
          <Detail label="חייל מבצע" value={mission.assignedSoldierName ?? 'טרם שויך'} />
          <Detail label="מרחק משוער" value={formatKm(mission.routeDistanceKmEstimate)} />
          <Detail label="זמן משוער" value={formatMinutes(mission.routeDurationMinutesEstimate)} />
          <Detail label="מספר רישוי" value={mission.licensePlate ?? '—'} />
        </Box>

        {mission.securedTransportNotes && (
          <Alert severity="warning" icon={<ShieldRoundedIcon />} sx={{ mt: 2 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700 }}>הנחיות נסיעה מאובטחת</Typography>
            <Typography sx={{ fontSize: 13 }}>{mission.securedTransportNotes}</Typography>
          </Alert>
        )}
      </Card>

      {mission.routeExplanation.length > 0 && (
        <Card sx={{ p: 2.5, mb: 2.5, backgroundColor: tones.primary.soft, borderColor: 'transparent' }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700, mb: 1 }}>למה זה המסלול</Typography>
          <Stack gap={0.5}>
            {mission.routeExplanation.map((line, index) => (
              <Typography key={index} sx={{ fontSize: 13 }}>
                • {line}
              </Typography>
            ))}
          </Stack>
        </Card>
      )}

      {/* עצירות */}
      <Card sx={{ p: 2.5, mb: 2.5 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 1.5 }}>מסלול ועצירות</Typography>

        {isCommander && mission.permissions.canEdit && mission.stops.length > 2 && (
          <Box sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: 13, color: palette.textSecondary, mb: 1 }}>
              אפשר לשנות את סדר העצירות בגרירה. המדדים יחושבו מחדש.
            </Typography>
            <StopSortableList
              stops={mission.stops.map((stop) => ({
                id: stop.id,
                title: `${stop.baseName} · ${stopTypeLabel(stop.stopType)}`,
                subtitle: `${stop.plannedPackageCount} אריזות · ${stopStatusLabel(stop.status)}`,
              }))}
              onReorder={(stopIds) => run(() => reorderStops.mutateAsync({ missionId: mission.id, stopIds }))}
            />
          </Box>
        )}

        <Stack gap={2}>
          {mission.stops.map((stop) => (
            <Box
              key={stop.id}
              sx={{
                p: 2,
                borderRadius: 2,
                border: `1px solid ${palette.border}`,
                backgroundColor:
                  stop.status === 'COMPLETED' ? tones.success.soft : palette.surface,
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={1}
                sx={{ mb: stop.packages.length ? 1.5 : 0 }}
              >
                <Stack direction="row" alignItems="center" gap={1.5}>
                  <Box
                    sx={{
                      width: 30,
                      height: 30,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      backgroundColor: tones.primary.main,
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: 13,
                    }}
                  >
                    {stop.sequence + 1}
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: 15, fontWeight: 700 }}>
                      {stop.baseName} · {stopTypeLabel(stop.stopType)}
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }}>
                      {stopStatusLabel(stop.status)}
                      {stop.arrivedAt ? ` · הגעה: ${formatDateTime(stop.arrivedAt)}` : ''}
                    </Typography>
                  </Box>
                </Stack>

                {mission.permissions.canDepart === false &&
                  mission.status === 'LOADING' &&
                  stop.stopType === 'PICKUP' &&
                  stop.status === 'PLANNED' && (
                    <Button
                      variant="outlined"
                      onClick={() =>
                        run(() => arrive.mutateAsync({ missionId: mission.id, stopId: stop.id }))
                      }
                    >
                      סימון הגעה
                    </Button>
                  )}
              </Stack>

              {stop.packages.length > 0 && (
                <Stack divider={<Divider />}>
                  {stop.packages.map((item) => (
                    <Stack
                      key={item.packageId}
                      direction="row"
                      alignItems="center"
                      justifyContent="space-between"
                      gap={1}
                      sx={{ py: 1 }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          component={Link}
                          to={`/packages/${item.packageId}`}
                          sx={{ fontSize: 14, fontWeight: 700, color: 'inherit', textDecoration: 'none' }}
                          dir="ltr"
                        >
                          {item.packageNumber}
                        </Typography>
                        <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }} noWrap>
                          {item.teamName} · {item.totalUnits} יחידות · {item.destinationRoomName}
                        </Typography>
                      </Box>

                      <Stack direction="row" alignItems="center" gap={1}>
                        <SoftBadge label={labels.package[item.status]} tone={packageTone[item.status]} />
                        {mission.status === 'LOADING' && !item.loadedAt && stop.status !== 'PLANNED' && (
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<QrCodeScannerRoundedIcon />}
                            onClick={() =>
                              run(() =>
                                loadPackage.mutateAsync({
                                  missionId: mission.id,
                                  packageId: item.packageId,
                                  idempotencyKey: `load-${item.packageId}`,
                                }),
                              )
                            }
                          >
                            סימון העמסה
                          </Button>
                        )}
                        {item.loadedAt && !item.unloadedAt && (
                          <Chip size="small" color="success" label="הועמסה" />
                        )}
                        {(mission.status === 'UNLOADING' || mission.status === 'IN_TRANSIT') &&
                          item.loadedAt &&
                          !item.unloadedAt && (
                            <Button
                              size="small"
                              variant="contained"
                              onClick={() =>
                                run(() =>
                                  unloadPackage.mutateAsync({
                                    missionId: mission.id,
                                    packageId: item.packageId,
                                    idempotencyKey: `unload-${item.packageId}`,
                                  }),
                                )
                              }
                            >
                              קליטה
                            </Button>
                          )}
                        {item.unloadedAt && <Chip size="small" color="success" label="נקלטה" />}
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Box>
          ))}
        </Stack>
      </Card>

      <ConfirmDialog
        open={departOpen}
        title="יציאה לדרך"
        description="מרגע היציאה כל האריזות בשליחות ננעלות ואי אפשר לשנות את תכולתן."
        confirmLabel="יציאה לדרך"
        loading={depart.isPending}
        onClose={() => setDepartOpen(false)}
        onConfirm={() =>
          run(async () => {
            await depart.mutateAsync(mission.id);
            setDepartOpen(false);
          })
        }
      />

      <ConfirmDialog
        open={joinOpen}
        title="בקשה להוספת איסוף"
        description="בחרו אריזות מוכנות מהבסיס שלכם. הבקשה תגיע למפקד הלוגיסטיקה לאישור."
        confirmLabel="שליחת הבקשה"
        loading={createJoinRequest.isPending}
        onClose={() => setJoinOpen(false)}
        onConfirm={() =>
          run(async () => {
            await createJoinRequest.mutateAsync({
              missionId: mission.id,
              input: {
                packageIds: [...joinSelection],
                note: joinNote.trim() || undefined,
              },
            });
            setJoinOpen(false);
            setJoinSelection(new Set());
            setJoinNote('');
          })
        }
      >
        <Stack sx={{ mt: 1 }}>
          {(myBasePackages?.items ?? []).length === 0 ? (
            <Typography sx={{ fontSize: 13.5, color: palette.textSecondary }}>
              אין אריזות מוכנות לשילוח בבסיס שלך
            </Typography>
          ) : (
            (myBasePackages?.items ?? []).map((pkg) => (
              <Stack key={pkg.id} direction="row" alignItems="center" gap={1}>
                <Checkbox
                  checked={joinSelection.has(pkg.id)}
                  onChange={() =>
                    setJoinSelection((current) => {
                      const next = new Set(current);
                      if (next.has(pkg.id)) next.delete(pkg.id);
                      else next.add(pkg.id);
                      return next;
                    })
                  }
                  inputProps={{ 'aria-label': `בחירת ${pkg.packageNumber}` }}
                />
                <Box>
                  <Typography sx={{ fontSize: 13.5, fontWeight: 700 }} dir="ltr">
                    {pkg.packageNumber}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: palette.textSecondary }}>
                    {pkg.sourceRoomName} · {pkg.totalUnits} יחידות
                  </Typography>
                </Box>
              </Stack>
            ))
          )}
          <TextField
            label="הערה למפקד"
            value={joinNote}
            onChange={(event) => setJoinNote(event.target.value)}
            size="small"
            multiline
            minRows={2}
            sx={{ mt: 1.5 }}
          />
        </Stack>
      </ConfirmDialog>
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

function stopTypeLabel(type: string): string {
  switch (type) {
    case 'START':
      return 'נקודת יציאה';
    case 'PICKUP':
      return 'איסוף';
    case 'DELIVERY_HUB':
      return 'פריקה';
    default:
      return 'סיום';
  }
}

function stopStatusLabel(status: string): string {
  switch (status) {
    case 'ARRIVED':
      return 'הגיע';
    case 'COMPLETED':
      return 'הושלמה';
    default:
      return 'מתוכננת';
  }
}

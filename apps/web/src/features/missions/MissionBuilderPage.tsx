import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import { useNavigate } from 'react-router-dom';
import { RouteSuggestionDto, UserRole, VEHICLE_TYPE_LABEL, VehicleType } from '@south/shared';
import {
  useBases,
  useCreateMission,
  usePackages,
  useRouteSuggestion,
  useUsers,
} from '../../api/queries';
import { toUserError } from '../../api/errors';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState, ListSkeleton } from '../../components/ui/States';
import { SoftBadge } from '../../components/ui/StatusBadge';
import { palette, tones } from '../../theme/tokens';
import { formatKm, formatMinutes, formatRelative } from '../../utils/format';
import { labels, priorityTone } from '../../utils/status';
import { StopSortableList } from './StopSortableList';

const ALL = 'ALL';

/** בניית שליחות: בחירת אריזות, הצעת מסלול, סידור עצירות ופרטי ביצוע (§8.6). */
export function MissionBuilderPage() {
  const navigate = useNavigate();
  const createMission = useCreateMission();
  const routeSuggestion = useRouteSuggestion();

  const [baseFilter, setBaseFilter] = useState<string>(ALL);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [suggestion, setSuggestion] = useState<RouteSuggestionDto | null>(null);
  const [manualOrder, setManualOrder] = useState<string[] | null>(null);

  const [title, setTitle] = useState('');
  const [plannedDepartureAt, setPlannedDepartureAt] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('TRUCK');
  const [licensePlate, setLicensePlate] = useState('');
  const [assignedSoldierId, setAssignedSoldierId] = useState('');
  const [requiresSecuredTransport, setRequiresSecuredTransport] = useState(false);
  const [securedTransportNotes, setSecuredTransportNotes] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: bases } = useBases();
  const { data: soldiers } = useUsers({ role: UserRole.LOGISTICS_SOLDIER, pageSize: 100 });
  const { data: available, isLoading } = usePackages({
    availableForMission: true,
    baseId: baseFilter === ALL ? undefined : baseFilter,
    pageSize: 100,
  });

  const packages = available?.items ?? [];

  const pickupStops = useMemo(() => {
    if (!suggestion) return [];
    const stops = suggestion.stops.filter((stop) => stop.stopType === 'PICKUP');
    if (!manualOrder) return stops;
    const byBase = new Map(stops.map((stop) => [stop.baseId, stop]));
    return manualOrder.map((baseId) => byBase.get(baseId)).filter(Boolean) as typeof stops;
  }, [suggestion, manualOrder]);

  const toggle = (packageId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(packageId)) next.delete(packageId);
      else next.add(packageId);
      return next;
    });
    setSuggestion(null);
    setManualOrder(null);
  };

  const requestSuggestion = async () => {
    setSubmitError(null);
    try {
      const result = await routeSuggestion.mutateAsync([...selected]);
      setSuggestion(result);
      setManualOrder(null);
    } catch (error) {
      const details = toUserError(error);
      setSubmitError(details.message);
    }
  };

  const submit = async () => {
    setSubmitError(null);
    try {
      const mission = await createMission.mutateAsync({
        title: title.trim(),
        plannedDepartureAt: new Date(plannedDepartureAt).toISOString(),
        vehicleType,
        licensePlate: licensePlate.trim() || undefined,
        assignedSoldierId: assignedSoldierId || undefined,
        requiresSecuredTransport,
        securedTransportNotes: requiresSecuredTransport
          ? securedTransportNotes.trim() || undefined
          : undefined,
        packageIds: [...selected],
        stopBaseOrder: manualOrder ?? undefined,
      });
      navigate(`/missions/${mission.id}`);
    } catch (error) {
      const details = toUserError(error);
      setSubmitError(details.hint ? `${details.message}. ${details.hint}` : details.message);
    }
  };

  const canSubmit =
    selected.size > 0 &&
    title.trim().length > 0 &&
    plannedDepartureAt.length > 0 &&
    (!requiresSecuredTransport || securedTransportNotes.trim().length > 0);

  return (
    <Box>
      <PageHeader
        title="תכנון שליחות"
        subtitle="בוחרים אריזות מוכנות, מקבלים הצעת מסלול ומשייכים חייל מבצע"
        icon={<RouteRoundedIcon />}
      />

      {submitError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSubmitError(null)}>
          {submitError}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' } }}>
        {/* בחירת אריזות */}
        <Card sx={{ p: 2.5 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ sm: 'center' }}
            gap={1.5}
            sx={{ mb: 2 }}
          >
            <Box>
              <Typography sx={{ fontSize: 16, fontWeight: 700 }}>אריזות מוכנות לשילוח</Typography>
              <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }}>
                מוצגות רק אריזות סגורות שטרם שובצו לשליחות
              </Typography>
            </Box>
            <TextField
              select
              size="small"
              label="בסיס"
              value={baseFilter}
              onChange={(event) => setBaseFilter(event.target.value)}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value={ALL}>כל הבסיסים</MenuItem>
              {(bases ?? [])
                .filter((base) => !base.isDestinationHub)
                .map((base) => (
                  <MenuItem key={base.id} value={base.id}>
                    {base.name}
                  </MenuItem>
                ))}
            </TextField>
          </Stack>

          {isLoading ? (
            <ListSkeleton rows={4} />
          ) : packages.length === 0 ? (
            <EmptyState
              title="אין אריזות מוכנות לשילוח"
              description="אריזה הופכת זמינה לשיבוץ אחרי שהחייל סוגר אותה"
            />
          ) : (
            <Stack divider={<Divider />} sx={{ maxHeight: 460, overflowY: 'auto' }}>
              {packages.map((pkg) => (
                <Stack
                  key={pkg.id}
                  direction="row"
                  alignItems="center"
                  gap={1}
                  sx={{ py: 1 }}
                >
                  <Checkbox
                    checked={selected.has(pkg.id)}
                    onChange={() => toggle(pkg.id)}
                    inputProps={{ 'aria-label': `בחירת אריזה ${pkg.packageNumber}` }}
                  />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" alignItems="center" gap={1}>
                      <Typography sx={{ fontSize: 14, fontWeight: 700 }} dir="ltr">
                        {pkg.packageNumber}
                      </Typography>
                      <SoftBadge
                        label={labels.priority[pkg.priority]}
                        tone={priorityTone[pkg.priority]}
                      />
                    </Stack>
                    <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }} noWrap>
                      {pkg.sourceBaseName} · {pkg.sourceRoomName} ← חדר {pkg.destination.roomNumber} ·{' '}
                      {pkg.totalUnits} יחידות · ממתינה {formatRelative(pkg.sealedAt)}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          )}

          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 2 }}>
            <Chip label={`נבחרו ${selected.size} אריזות`} color={selected.size ? 'primary' : 'default'} />
            <Button
              variant="outlined"
              startIcon={<AutoAwesomeRoundedIcon />}
              disabled={selected.size === 0 || routeSuggestion.isPending}
              onClick={requestSuggestion}
            >
              הצעת מסלול
            </Button>
          </Stack>
        </Card>

        {/* מסלול ופרטים */}
        <Stack gap={2}>
          {suggestion && (
            <Card sx={{ p: 2.5 }}>
              <Typography sx={{ fontSize: 16, fontWeight: 700 }}>המסלול המוצע</Typography>
              <Stack direction="row" gap={1} sx={{ my: 1.5, flexWrap: 'wrap' }}>
                <Chip size="small" label={formatKm(suggestion.totalDistanceKm)} />
                <Chip size="small" label={formatMinutes(suggestion.totalDurationMinutes)} />
                <Chip
                  size="small"
                  color="success"
                  label={`חוסך ${suggestion.estimatedTripsSaved} נסיעות (הערכה)`}
                />
              </Stack>

              <Stack gap={1} sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>למה זה המסלול</Typography>
                {suggestion.explanation.map((line, index) => (
                  <Typography key={index} sx={{ fontSize: 12.5, color: palette.textSecondary }}>
                    • {line}
                  </Typography>
                ))}
              </Stack>

              <Divider sx={{ mb: 2 }} />

              <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1 }}>
                סדר עצירות האיסוף (אפשר לגרור או להשתמש בחצים)
              </Typography>

              <Box sx={{ mb: 1.5, p: 1.25, borderRadius: 2, backgroundColor: palette.surfaceMuted }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                  יציאה: קריית התקשוב
                </Typography>
              </Box>

              <StopSortableList
                stops={pickupStops.map((stop) => ({
                  id: stop.baseId,
                  title: stop.baseName,
                  subtitle: `${stop.packageCount} אריזות${
                    stop.highestPriority ? ` · ${labels.priority[stop.highestPriority]}` : ''
                  }`,
                }))}
                onReorder={setManualOrder}
              />

              <Box sx={{ mt: 1.5, p: 1.25, borderRadius: 2, backgroundColor: palette.surfaceMuted }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                  פריקה: קריית התקשוב
                </Typography>
              </Box>

              {manualOrder && (
                <Alert severity="info" sx={{ mt: 1.5 }}>
                  סדר העצירות שונה ידנית. המדדים יחושבו מחדש בעת השמירה.
                </Alert>
              )}
            </Card>
          )}

          <Card sx={{ p: 2.5 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 2 }}>פרטי השליחות</Typography>

            <Stack gap={2}>
              <TextField
                label="כותרת השליחות"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                size="medium"
                placeholder="לדוגמה: איסוף מגדעונים וצריפין"
              />

              <TextField
                type="datetime-local"
                label="תאריך ושעת יציאה"
                value={plannedDepartureAt}
                onChange={(event) => setPlannedDepartureAt(event.target.value)}
                InputLabelProps={{ shrink: true }}
                size="medium"
              />

              <Stack direction="row" gap={2}>
                <TextField
                  select
                  label="סוג רכב"
                  value={vehicleType}
                  onChange={(event) => setVehicleType(event.target.value as VehicleType)}
                  size="medium"
                  sx={{ flex: 1 }}
                >
                  {(['TRUCK', 'OTHER'] as VehicleType[]).map((value) => (
                    <MenuItem key={value} value={value}>
                      {VEHICLE_TYPE_LABEL[value]}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  label="מספר רישוי"
                  value={licensePlate}
                  onChange={(event) => setLicensePlate(event.target.value)}
                  size="medium"
                  sx={{ flex: 1 }}
                  inputProps={{ dir: 'ltr' }}
                />
              </Stack>

              <TextField
                select
                label="חייל מבצע"
                value={assignedSoldierId}
                onChange={(event) => setAssignedSoldierId(event.target.value)}
                size="medium"
                helperText="בלי חייל מבצע השליחות תישמר כטיוטה"
              >
                {(soldiers?.items ?? []).map((soldier) => (
                  <MenuItem key={soldier.id} value={soldier.id}>
                    {soldier.fullName}
                    {soldier.baseName ? ` · ${soldier.baseName}` : ''}
                  </MenuItem>
                ))}
              </TextField>

              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  backgroundColor: requiresSecuredTransport ? tones.warning.soft : palette.surfaceMuted,
                }}
              >
                <FormControlLabel
                  control={
                    <Switch
                      checked={requiresSecuredTransport}
                      onChange={(event) => setRequiresSecuredTransport(event.target.checked)}
                    />
                  }
                  label={
                    <Stack direction="row" alignItems="center" gap={0.75}>
                      <ShieldRoundedIcon fontSize="small" />
                      <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
                        נדרשת נסיעה מאובטחת
                      </Typography>
                    </Stack>
                  }
                />
                {requiresSecuredTransport && (
                  <TextField
                    label="הנחיות (מוצגות למורשים בלבד)"
                    value={securedTransportNotes}
                    onChange={(event) => setSecuredTransportNotes(event.target.value)}
                    multiline
                    minRows={2}
                    fullWidth
                    size="medium"
                    sx={{ mt: 1 }}
                  />
                )}
              </Box>

              <Button
                variant="contained"
                size="large"
                disabled={!canSubmit || createMission.isPending}
                onClick={submit}
              >
                יצירת השליחות
              </Button>
            </Stack>
          </Card>
        </Stack>
      </Box>
    </Box>
  );
}

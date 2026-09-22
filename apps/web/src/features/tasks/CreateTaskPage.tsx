import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  Divider,
  InputAdornment,
  MenuItem,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ComputerRoundedIcon from '@mui/icons-material/ComputerRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import AddTaskRoundedIcon from '@mui/icons-material/AddTaskRounded';
import { useNavigate } from 'react-router-dom';
import {
  HUB_BUILDING_NAME,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  TaskPriority,
  UserRole,
} from '@south/shared';
import {
  useBases,
  useCreateTask,
  useRoomInventory,
  useRooms,
  useTeams,
  useUsers,
} from '../../api/queries';
import { toUserError } from '../../api/errors';
import { PageHeader } from '../../components/ui/PageHeader';
import { ListSkeleton } from '../../components/ui/States';
import { palette, tones } from '../../theme/tokens';

const STEPS = ['מקור ויעד', 'בחירת ציוד', 'שיוך ופרטים'];

/** בניית משימת אריזה מפורטת על ידי מפקד הלוגיסטיקה (§8.2). */
export function CreateTaskPage() {
  const navigate = useNavigate();
  const createTask = useCreateTask();

  const [activeStep, setActiveStep] = useState(0);
  const [sourceBaseId, setSourceBaseId] = useState('');
  const [sourceRoomId, setSourceRoomId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [destinationRoomId, setDestinationRoomId] = useState('');
  const [assetSearch, setAssetSearch] = useState('');
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [bulkQuantities, setBulkQuantities] = useState<Record<string, number>>({});
  const [assignedSoldierId, setAssignedSoldierId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('NORMAL');
  const [dueAt, setDueAt] = useState('');
  const [notes, setNotes] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: bases } = useBases();
  const hubBase = bases?.find((base) => base.isDestinationHub);

  const { data: sourceRooms } = useRooms(
    { baseId: sourceBaseId, pageSize: 100 },
    Boolean(sourceBaseId),
  );
  const { data: hubRooms } = useRooms(
    { baseId: hubBase?.id, building: HUB_BUILDING_NAME, pageSize: 100 },
    Boolean(hubBase?.id),
  );
  const { data: teams } = useTeams();
  const { data: soldiers } = useUsers({ role: UserRole.LOGISTICS_SOLDIER, pageSize: 100 });
  const { data: inventory, isLoading: inventoryLoading } = useRoomInventory(sourceRoomId || undefined);

  const availableAssets = useMemo(() => {
    const assets = inventory?.assets ?? [];
    const term = assetSearch.trim().toLowerCase();
    return assets
      .filter((asset) => asset.status === 'AVAILABLE')
      .filter(
        (asset) =>
          !term ||
          asset.assetTag.toLowerCase().includes(term) ||
          asset.ownerName.toLowerCase().includes(term),
      );
  }, [inventory, assetSearch]);

  const availableBulk = useMemo(
    () => (inventory?.bulkLines ?? []).filter((line) => line.availableQuantity > 0),
    [inventory],
  );

  const selectedUnits =
    selectedAssets.size + Object.values(bulkQuantities).reduce((sum, qty) => sum + qty, 0);

  const canContinueStep0 = Boolean(sourceRoomId && destinationRoomId && teamId);
  const canContinueStep1 = selectedUnits > 0;
  const canSubmit = canContinueStep0 && canContinueStep1 && Boolean(assignedSoldierId);

  const toggleAsset = (assetId: string) => {
    setSelectedAssets((current) => {
      const next = new Set(current);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  };

  const submit = async () => {
    setSubmitError(null);
    const assetById = new Map((inventory?.assets ?? []).map((asset) => [asset.id, asset]));

    const lines = [
      ...[...selectedAssets].map((assetId) => ({
        productCatalogItemId: assetById.get(assetId)!.productCatalogItemId,
        assetInstanceId: assetId,
        requestedQuantity: 1,
      })),
      ...Object.entries(bulkQuantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([productCatalogItemId, quantity]) => ({
          productCatalogItemId,
          requestedQuantity: quantity,
        })),
    ];

    try {
      const task = await createTask.mutateAsync({
        sourceRoomId,
        destinationRoomId,
        teamId,
        assignedSoldierId,
        priority,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        notes: notes.trim() || undefined,
        lines,
      });
      navigate(`/tasks/${task.id}`);
    } catch (error) {
      const details = toUserError(error);
      setSubmitError(details.hint ? `${details.message}. ${details.hint}` : details.message);
    }
  };

  return (
    <Box>
      <PageHeader
        title="משימת אריזה חדשה"
        subtitle="בוחרים חדר מקור, חדר יעד, את הציוד המדויק ואת החייל המבצע"
        icon={<AddTaskRoundedIcon />}
      />

      <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {submitError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSubmitError(null)}>
          {submitError}
        </Alert>
      )}

      {/* שלב 1 */}
      {activeStep === 0 && (
        <Card sx={{ p: 2.5 }}>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            }}
          >
            <TextField
              select
              label="בסיס מקור"
              value={sourceBaseId}
              onChange={(event) => {
                setSourceBaseId(event.target.value);
                setSourceRoomId('');
                setSelectedAssets(new Set());
                setBulkQuantities({});
              }}
              size="medium"
            >
              {(bases ?? []).map((base) => (
                <MenuItem key={base.id} value={base.id}>
                  {base.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="חדר מקור"
              value={sourceRoomId}
              onChange={(event) => {
                setSourceRoomId(event.target.value);
                setSelectedAssets(new Set());
                setBulkQuantities({});
              }}
              disabled={!sourceBaseId}
              size="medium"
            >
              {(sourceRooms?.items ?? []).map((room) => (
                <MenuItem key={room.id} value={room.id}>
                  {room.displayName}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="צוות"
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
              size="medium"
            >
              {(teams ?? []).map((team) => (
                <MenuItem key={team.id} value={team.id}>
                  {team.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="חדר יעד בקריית התקשוב"
              value={destinationRoomId}
              onChange={(event) => setDestinationRoomId(event.target.value)}
              size="medium"
            >
              {(hubRooms?.items ?? []).map((room) => (
                <MenuItem key={room.id} value={room.id}>
                  קומה {room.floor} · חדר {room.roomNumber} · {room.displayName}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 3 }}>
            <Button
              variant="contained"
              size="large"
              disabled={!canContinueStep0}
              onClick={() => setActiveStep(1)}
            >
              המשך לבחירת ציוד
            </Button>
          </Stack>
        </Card>
      )}

      {/* שלב 2 */}
      {activeStep === 1 && (
        <Stack gap={2}>
          <Card sx={{ p: 2.5 }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ sm: 'center' }}
              justifyContent="space-between"
              gap={1.5}
              sx={{ mb: 2 }}
            >
              <Box>
                <Typography sx={{ fontSize: 16, fontWeight: 700 }}>
                  מחשבים ומסכים בחדר
                </Typography>
                <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }}>
                  בחירה לפי מזהה המדבקה או לפי שם הבעלים
                </Typography>
              </Box>
              <TextField
                size="small"
                placeholder="חיפוש לפי מזהה או בעלים"
                value={assetSearch}
                onChange={(event) => setAssetSearch(event.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRoundedIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                sx={{ minWidth: 240 }}
              />
            </Stack>

            {inventoryLoading ? (
              <ListSkeleton rows={4} />
            ) : availableAssets.length === 0 ? (
              <Typography sx={{ fontSize: 13.5, color: palette.textSecondary, py: 2 }}>
                אין מחשבים או מסכים זמינים בחדר הזה
              </Typography>
            ) : (
              <Stack divider={<Divider />} sx={{ maxHeight: 360, overflowY: 'auto' }}>
                {availableAssets.map((asset) => (
                  <Stack
                    key={asset.id}
                    direction="row"
                    alignItems="center"
                    gap={1.5}
                    sx={{ py: 1 }}
                  >
                    <Checkbox
                      checked={selectedAssets.has(asset.id)}
                      onChange={() => toggleAsset(asset.id)}
                      inputProps={{ 'aria-label': `בחירת ${asset.assetTag}` }}
                    />
                    <ComputerRoundedIcon sx={{ color: palette.textSecondary }} />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
                        {asset.productName}
                      </Typography>
                      <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }}>
                        מזהה {asset.assetTag} · בעלים: {asset.ownerName}
                      </Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            )}
          </Card>

          <Card sx={{ p: 2.5 }}>
            <Typography sx={{ fontSize: 16, fontWeight: 700 }}>ציוד כמותי</Typography>
            <Typography sx={{ fontSize: 12.5, color: palette.textSecondary, mb: 2 }}>
              בחירה לפי מק״ט וכמות. אי אפשר לבחור יותר מהכמות הזמינה בחדר
            </Typography>

            {availableBulk.length === 0 ? (
              <Typography sx={{ fontSize: 13.5, color: palette.textSecondary, py: 2 }}>
                אין ציוד כמותי זמין בחדר הזה
              </Typography>
            ) : (
              <Stack divider={<Divider />}>
                {availableBulk.map((line) => (
                  <Stack
                    key={line.productCatalogItemId}
                    direction="row"
                    alignItems="center"
                    gap={1.5}
                    sx={{ py: 1.25 }}
                  >
                    <Inventory2RoundedIcon sx={{ color: palette.textSecondary }} />
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
                        {line.productName}
                      </Typography>
                      <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }}>
                        מק״ט {line.sku} · זמין: {line.availableQuantity} {line.unitOfMeasure}
                      </Typography>
                    </Box>
                    <TextField
                      type="number"
                      size="small"
                      label="כמות"
                      value={bulkQuantities[line.productCatalogItemId] ?? ''}
                      onChange={(event) => {
                        const raw = Number(event.target.value);
                        const clamped = Math.max(0, Math.min(line.availableQuantity, raw || 0));
                        setBulkQuantities((current) => ({
                          ...current,
                          [line.productCatalogItemId]: clamped,
                        }));
                      }}
                      inputProps={{ min: 0, max: line.availableQuantity, style: { width: 72 } }}
                    />
                  </Stack>
                ))}
              </Stack>
            )}
          </Card>

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Chip
              label={`נבחרו ${selectedUnits} יחידות`}
              color={selectedUnits > 0 ? 'primary' : 'default'}
            />
            <Stack direction="row" gap={1}>
              <Button onClick={() => setActiveStep(0)}>חזרה</Button>
              <Button
                variant="contained"
                size="large"
                disabled={!canContinueStep1}
                onClick={() => setActiveStep(2)}
              >
                המשך
              </Button>
            </Stack>
          </Stack>
        </Stack>
      )}

      {/* שלב 3 */}
      {activeStep === 2 && (
        <Card sx={{ p: 2.5 }}>
          <Box
            sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}
          >
            <TextField
              select
              label="חייל מבצע"
              value={assignedSoldierId}
              onChange={(event) => setAssignedSoldierId(event.target.value)}
              size="medium"
            >
              {(soldiers?.items ?? []).map((soldier) => (
                <MenuItem key={soldier.id} value={soldier.id}>
                  {soldier.fullName}
                  {soldier.baseName ? ` · ${soldier.baseName}` : ''}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="דחיפות"
              value={priority}
              onChange={(event) => setPriority(event.target.value as TaskPriority)}
              size="medium"
            >
              {TASK_PRIORITIES.map((value) => (
                <MenuItem key={value} value={value}>
                  {TASK_PRIORITY_LABEL[value]}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              type="datetime-local"
              label="יעד לביצוע"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              InputLabelProps={{ shrink: true }}
              size="medium"
            />

            <TextField
              label="הערה לחייל"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              multiline
              minRows={2}
              size="medium"
            />
          </Box>

          <Box sx={{ mt: 3, p: 2, borderRadius: 2, backgroundColor: tones.primary.soft }}>
            <Typography sx={{ fontSize: 13.5, fontWeight: 700, mb: 0.5 }}>סיכום המשימה</Typography>
            <Typography sx={{ fontSize: 13 }}>
              {selectedAssets.size} מחשבים/מסכים ·{' '}
              {Object.values(bulkQuantities).reduce((sum, qty) => sum + qty, 0)} יחידות ציוד כמותי
            </Typography>
          </Box>

          <Stack direction="row" justifyContent="space-between" sx={{ mt: 3 }}>
            <Button onClick={() => setActiveStep(1)}>חזרה</Button>
            <Button
              variant="contained"
              size="large"
              disabled={!canSubmit || createTask.isPending}
              onClick={submit}
            >
              יצירת המשימה
            </Button>
          </Stack>
        </Card>
      )}
    </Box>
  );
}

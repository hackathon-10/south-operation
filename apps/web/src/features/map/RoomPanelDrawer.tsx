import {
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ComputerRoundedIcon from '@mui/icons-material/ComputerRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import { Link } from 'react-router-dom';
import { ROOM_MAP_STATE_LABEL } from '@south/shared';
import { useRoomPanel } from '../../api/queries';
import { SoftBadge } from '../../components/ui/StatusBadge';
import { ErrorState, ListSkeleton } from '../../components/ui/States';
import { palette, tones } from '../../theme/tokens';
import { labels, packageTone, roomStateTone, taskTone } from '../../utils/status';

/** פאנל פרטי חדר: מלאי, מחשבים לפי בעלים, משימות פעילות ואריזות בדרך. */
export function RoomPanelDrawer({
  roomId,
  onClose,
  anchor = 'left',
}: {
  roomId: string | null;
  onClose: () => void;
  anchor?: 'left' | 'bottom';
}) {
  const { data, isLoading, error, refetch } = useRoomPanel(roomId ?? undefined);

  return (
    <Drawer
      open={Boolean(roomId)}
      onClose={onClose}
      anchor={anchor}
      PaperProps={{
        sx: {
          width: anchor === 'left' ? { xs: '100%', sm: 440 } : '100%',
          maxHeight: anchor === 'bottom' ? '85dvh' : '100%',
          p: 2.5,
        },
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 800 }}>פרטי החדר</Typography>
        <IconButton onClick={onClose} aria-label="סגירת הפאנל">
          <CloseRoundedIcon />
        </IconButton>
      </Stack>

      {isLoading && <ListSkeleton rows={4} />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && (
        <Stack gap={2}>
          <Box>
            <Typography sx={{ fontSize: 22, fontWeight: 800 }}>
              חדר {data.room.roomNumber}
            </Typography>
            <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{data.room.displayName}</Typography>
            <Typography sx={{ fontSize: 13, color: palette.textSecondary }}>
              {data.room.building} · קומה {data.room.floor}
            </Typography>

            <Stack direction="row" gap={1} sx={{ mt: 1.5, flexWrap: 'wrap' }}>
              <SoftBadge
                label={ROOM_MAP_STATE_LABEL[data.state]}
                tone={roomStateTone[data.state]}
              />
              {data.teamName && <Chip size="small" label={`צוות: ${data.teamName}`} />}
              {data.leadUserName && <Chip size="small" label={`אחראי: ${data.leadUserName}`} />}
            </Stack>
          </Box>

          <Stack direction="row" gap={1}>
            <Metric label="סה״כ פריטים" value={data.totals.totalUnits} tone="primary" />
            <Metric label="מחשבים ומסכים" value={data.totals.assetUnits} tone="violet" />
            <Metric label="ציוד כמותי" value={data.totals.bulkUnits} tone="info" />
          </Stack>

          <Divider />

          <Section title={`מחשבים ומסכים (${data.assets.length})`}>
            {data.assets.length === 0 ? (
              <Empty text="אין מחשבים או מסכים רשומים בחדר" />
            ) : (
              <Stack divider={<Divider />}>
                {data.assets.map((asset) => (
                  <Stack key={asset.id} direction="row" alignItems="center" gap={1.25} sx={{ py: 1 }}>
                    <ComputerRoundedIcon sx={{ color: palette.textSecondary }} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 700 }} noWrap>
                        {asset.productName}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: palette.textSecondary }} noWrap>
                        מזהה {asset.assetTag} · בעלים: {asset.ownerName}
                      </Typography>
                    </Box>
                  </Stack>
                ))}
              </Stack>
            )}
          </Section>

          <Section title={`ציוד כמותי (${data.bulkLines.length})`}>
            {data.bulkLines.length === 0 ? (
              <Empty text="אין ציוד כמותי רשום בחדר" />
            ) : (
              <Stack divider={<Divider />}>
                {data.bulkLines.map((line) => (
                  <Stack
                    key={line.productCatalogItemId}
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    gap={1}
                    sx={{ py: 1 }}
                  >
                    <Stack direction="row" alignItems="center" gap={1.25} sx={{ minWidth: 0 }}>
                      <Inventory2RoundedIcon sx={{ color: palette.textSecondary }} />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: 13.5, fontWeight: 700 }} noWrap>
                          {line.productName}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: palette.textSecondary }}>
                          מק״ט {line.sku}
                        </Typography>
                      </Box>
                    </Stack>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>
                      {line.mappedQuantity} {line.unitOfMeasure}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            )}
          </Section>

          {data.activeTasks.length > 0 && (
            <Section title={`משימות אריזה פעילות (${data.activeTasks.length})`}>
              <Stack divider={<Divider />}>
                {data.activeTasks.map((task) => (
                  <Stack
                    key={task.id}
                    component={Link}
                    to={`/tasks/${task.id}`}
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ py: 1, textDecoration: 'none', color: 'inherit' }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>
                        {task.taskNumber}
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: palette.textSecondary }} noWrap>
                        {task.sourceRoomName} · {task.progress.percent}% נארז
                      </Typography>
                    </Box>
                    <SoftBadge label={labels.task[task.status]} tone={taskTone[task.status]} />
                  </Stack>
                ))}
              </Stack>
            </Section>
          )}

          {data.incomingPackages.length > 0 && (
            <Section title={`אריזות בדרך לחדר (${data.incomingPackages.length})`}>
              <PackageList packages={data.incomingPackages} />
            </Section>
          )}

          {data.arrivedPackages.length > 0 && (
            <Section title={`אריזות שהגיעו (${data.arrivedPackages.length})`}>
              <PackageList packages={data.arrivedPackages} />
            </Section>
          )}
        </Stack>
      )}
    </Drawer>
  );
}

function PackageList({
  packages,
}: {
  packages: Array<{
    id: string;
    packageNumber: string;
    status: keyof typeof packageTone;
    totalUnits: number;
    teamName: string;
  }>;
}) {
  return (
    <Stack divider={<Divider />}>
      {packages.map((pkg) => (
        <Stack
          key={pkg.id}
          component={Link}
          to={`/packages/${pkg.id}`}
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ py: 1, textDecoration: 'none', color: 'inherit' }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 13.5, fontWeight: 700 }} dir="ltr" textAlign="start">
              {pkg.packageNumber}
            </Typography>
            <Typography sx={{ fontSize: 12, color: palette.textSecondary }} noWrap>
              {pkg.teamName} · {pkg.totalUnits} יחידות
            </Typography>
          </Box>
          <SoftBadge label={labels.package[pkg.status]} tone={packageTone[pkg.status]} />
        </Stack>
      ))}
    </Stack>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 0.75 }}>{title}</Typography>
      {children}
    </Box>
  );
}

function Empty({ text }: { text: string }) {
  return <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }}>{text}</Typography>;
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'primary' | 'violet' | 'info';
}) {
  return (
    <Box
      sx={{
        flex: 1,
        p: 1.25,
        borderRadius: 2,
        backgroundColor: tones[tone].soft,
        textAlign: 'center',
      }}
    >
      <Typography sx={{ fontSize: 20, fontWeight: 800, color: tones[tone].main }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: 11.5, color: palette.textSecondary }}>{label}</Typography>
    </Box>
  );
}

import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Card,
  Chip,
  IconButton,
  InputAdornment,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded';
import ZoomOutRoundedIcon from '@mui/icons-material/ZoomOutRounded';
import {
  FloorMapRoomShapeDto,
  HUB_BUILDING_NAME,
  ROOM_MAP_STATE_LABEL,
  RoomMapState,
} from '@south/shared';
import { useBases, useFloorMap, useFloorMapSearch, useFloorMaps } from '../../api/queries';
import { PageHeader } from '../../components/ui/PageHeader';
import { ErrorState, ListSkeleton } from '../../components/ui/States';
import { palette, radii, tones } from '../../theme/tokens';
import { roomStateTone } from '../../utils/status';
import { RoomPanelDrawer } from './RoomPanelDrawer';

const ZOOM_LEVELS = [1, 1.4, 1.9];

/** מפת חדרים אינטראקטיבית של בניין היעד - חמש קומות, נתונים אמיתיים (§10.7). */
export function FloorMapPage() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  const { data: bases } = useBases();
  const hubBase = bases?.find((base) => base.isDestinationHub);
  const { data: floorMaps } = useFloorMaps(
    hubBase ? { baseId: hubBase.id, building: HUB_BUILDING_NAME } : undefined,
  );

  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [highlightRoomId, setHighlightRoomId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [zoomIndex, setZoomIndex] = useState(0);

  useEffect(() => {
    if (!selectedMapId && floorMaps && floorMaps.length > 0) {
      setSelectedMapId(floorMaps[0].id);
    }
  }, [floorMaps, selectedMapId]);

  const { data: floor, isLoading, error, refetch } = useFloorMap(selectedMapId ?? undefined);
  const { data: searchHits } = useFloorMapSearch(search, {
    baseId: hubBase?.id,
    building: HUB_BUILDING_NAME,
  });

  const legend = useMemo(
    () =>
      (Object.keys(ROOM_MAP_STATE_LABEL) as RoomMapState[]).map((state) => ({
        state,
        label: ROOM_MAP_STATE_LABEL[state],
        tone: roomStateTone[state],
      })),
    [],
  );

  const zoom = ZOOM_LEVELS[zoomIndex];

  return (
    <Box>
      <PageHeader
        title="מפת החדרים"
        subtitle={`${HUB_BUILDING_NAME} · חמש קומות · לחיצה על חדר מציגה את הציוד שבו`}
        icon={<MapRoundedIcon />}
      />

      {/* חיפוש חוצה-מפה */}
      <Card sx={{ p: 2, mb: 2 }}>
        <TextField
          fullWidth
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="חיפוש לפי מספר חדר, צוות, שם בעלים, מזהה מחשב או מק״ט..."
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ color: palette.textSecondary }} />
              </InputAdornment>
            ),
            sx: { borderRadius: radii.pill },
          }}
          inputProps={{ 'aria-label': 'חיפוש במפת החדרים' }}
        />

        {search.trim().length >= 2 && (
          <Stack gap={0.5} sx={{ mt: 1.5, maxHeight: 220, overflowY: 'auto' }}>
            {(searchHits ?? []).length === 0 ? (
              <Typography sx={{ fontSize: 13, color: palette.textSecondary }}>
                לא נמצאו תוצאות מתאימות
              </Typography>
            ) : (
              (searchHits ?? []).map((hit) => (
                <Stack
                  key={`${hit.roomId}-${hit.matchedOn}-${hit.matchedValue}`}
                  component="button"
                  type="button"
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  gap={1}
                  onClick={() => {
                    setSelectedMapId(hit.floorMapId);
                    setHighlightRoomId(hit.roomId);
                    setSelectedRoomId(hit.roomId);
                  }}
                  sx={{
                    textAlign: 'start',
                    border: `1px solid ${palette.border}`,
                    borderRadius: radii.control,
                    background: palette.surface,
                    p: 1,
                    cursor: 'pointer',
                    '&:hover': { borderColor: tones.primary.main },
                  }}
                >
                  <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>
                    קומה {hit.floorNumber} · חדר {hit.roomNumber} · {hit.displayName}
                  </Typography>
                  <Chip size="small" label={`${matchLabel(hit.matchedOn)}: ${hit.matchedValue}`} />
                </Stack>
              ))
            )}
          </Stack>
        )}
      </Card>

      {/* בורר קומות */}
      <Card sx={{ p: 1, mb: 2 }}>
        <Tabs
          value={selectedMapId ?? false}
          onChange={(_, value) => {
            setSelectedMapId(value);
            setHighlightRoomId(null);
          }}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="בחירת קומה"
        >
          {(floorMaps ?? []).map((map) => (
            <Tab
              key={map.id}
              value={map.id}
              label={`קומה ${map.floorNumber}`}
              sx={{ fontWeight: 700 }}
            />
          ))}
        </Tabs>
      </Card>

      {isLoading && <ListSkeleton rows={4} />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}

      {floor && (
        <Card sx={{ p: { xs: 1.5, md: 2.5 } }}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 1.5 }}
          >
            <Box>
              <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{floor.map.displayName}</Typography>
              <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }}>
                {floor.rooms.length} חדרים · לחיצה על חדר פותחת את פרטיו
              </Typography>
            </Box>

            {!isDesktop && (
              <Stack direction="row" gap={0.5}>
                <IconButton
                  onClick={() => setZoomIndex((index) => Math.max(0, index - 1))}
                  disabled={zoomIndex === 0}
                  aria-label="התרחקות"
                >
                  <ZoomOutRoundedIcon />
                </IconButton>
                <IconButton
                  onClick={() => setZoomIndex((index) => Math.min(ZOOM_LEVELS.length - 1, index + 1))}
                  disabled={zoomIndex === ZOOM_LEVELS.length - 1}
                  aria-label="התקרבות"
                >
                  <ZoomInRoundedIcon />
                </IconButton>
              </Stack>
            )}
          </Stack>

          <Box sx={{ overflowX: 'auto', pb: 1 }}>
            <Box sx={{ width: `${zoom * 100}%`, minWidth: isDesktop ? 'auto' : 520 }}>
              <svg
                viewBox={`0 0 ${floor.map.canvasWidth} ${floor.map.canvasHeight}`}
                width="100%"
                role="group"
                aria-label={`מפת ${floor.map.displayName}`}
                style={{ display: 'block' }}
              >
                {/* מסדרון מרכזי */}
                <rect
                  x={floor.corridor.x}
                  y={floor.corridor.y}
                  width={floor.corridor.width}
                  height={floor.corridor.height}
                  rx={8}
                  fill={palette.surfaceMuted}
                  stroke={palette.border}
                  strokeWidth={2}
                />
                <text
                  x={floor.map.canvasWidth / 2}
                  y={floor.corridor.y + floor.corridor.height / 2 + 5}
                  textAnchor="middle"
                  fontSize={16}
                  fontWeight={700}
                  fill={palette.textSecondary}
                >
                  מסדרון מרכזי
                </text>

                {floor.rooms.map((room) => (
                  <RoomShape
                    key={room.roomId}
                    room={room}
                    isHighlighted={highlightRoomId === room.roomId}
                    onSelect={() => setSelectedRoomId(room.roomId)}
                  />
                ))}
              </svg>
            </Box>
          </Box>

          {/* מקרא טקסטואלי - לא מסתמכים על צבע בלבד */}
          <Stack direction="row" gap={1.5} sx={{ mt: 2, flexWrap: 'wrap' }}>
            {legend.map((item) => (
              <Stack key={item.state} direction="row" alignItems="center" gap={0.75}>
                <Box
                  sx={{
                    width: 14,
                    height: 14,
                    borderRadius: 0.75,
                    backgroundColor: tones[item.tone].soft,
                    border: `2px solid ${tones[item.tone].main}`,
                  }}
                  aria-hidden="true"
                />
                <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }}>
                  {item.label}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Card>
      )}

      <RoomPanelDrawer
        roomId={selectedRoomId}
        onClose={() => setSelectedRoomId(null)}
        anchor={isDesktop ? 'left' : 'bottom'}
      />
    </Box>
  );
}

function RoomShape({
  room,
  isHighlighted,
  onSelect,
}: {
  room: FloorMapRoomShapeDto;
  isHighlighted: boolean;
  onSelect: () => void;
}) {
  const tone = tones[roomStateTone[room.state]];
  const ariaLabel = [
    `חדר ${room.roomNumber}`,
    room.displayName,
    room.teamName ? `צוות ${room.teamName}` : 'ללא צוות משויך',
    `${room.totalUnits} פריטי ציוד`,
    ROOM_MAP_STATE_LABEL[room.state],
  ].join(', ');

  return (
    <Tooltip
      title={
        <Box>
          <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>
            חדר {room.roomNumber} · {room.displayName}
          </Typography>
          <Typography sx={{ fontSize: 12 }}>
            {room.teamName ?? 'ללא צוות'} · {room.totalUnits} פריטים
          </Typography>
          <Typography sx={{ fontSize: 12 }}>{ROOM_MAP_STATE_LABEL[room.state]}</Typography>
        </Box>
      }
      followCursor
    >
      <g
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect();
          }
        }}
        style={{ cursor: 'pointer' }}
      >
        <rect
          x={room.x}
          y={room.y}
          width={room.width}
          height={room.height}
          rx={10}
          fill={tone.soft}
          stroke={isHighlighted ? palette.textPrimary : tone.main}
          strokeWidth={isHighlighted ? 5 : 2.5}
        />
        <text
          x={room.x + room.width / 2}
          y={room.y + 38}
          textAnchor="middle"
          fontSize={26}
          fontWeight={800}
          fill={palette.textPrimary}
        >
          {room.roomNumber}
        </text>
        <text
          x={room.x + room.width / 2}
          y={room.y + 66}
          textAnchor="middle"
          fontSize={14}
          fill={palette.textPrimary}
        >
          {truncate(room.displayName, 20)}
        </text>
        {room.teamName && (
          <text
            x={room.x + room.width / 2}
            y={room.y + 90}
            textAnchor="middle"
            fontSize={12.5}
            fill={palette.textSecondary}
          >
            {truncate(room.teamName, 22)}
          </text>
        )}
        <text
          x={room.x + room.width / 2}
          y={room.y + room.height - 44}
          textAnchor="middle"
          fontSize={13}
          fontWeight={700}
          fill={tone.main}
        >
          {room.totalUnits} פריטים
        </text>
        <text
          x={room.x + room.width / 2}
          y={room.y + room.height - 22}
          textAnchor="middle"
          fontSize={12}
          fill={palette.textSecondary}
        >
          {ROOM_MAP_STATE_LABEL[room.state]}
        </text>
      </g>
    </Tooltip>
  );
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function matchLabel(matchedOn: string): string {
  switch (matchedOn) {
    case 'TEAM':
      return 'צוות';
    case 'OWNER':
      return 'בעלים';
    case 'ASSET_TAG':
      return 'מזהה';
    case 'SKU':
      return 'מק״ט';
    default:
      return 'חדר';
  }
}

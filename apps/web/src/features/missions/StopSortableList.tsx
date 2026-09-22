import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Box, IconButton, Stack, Typography } from '@mui/material';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import { palette, radii, tones } from '../../theme/tokens';

export interface SortableStop {
  id: string;
  title: string;
  subtitle: string;
}

/**
 * סידור עצירות בגרירה, עם חלופת מקלדת (חצים) לנגישות מלאה -
 * גרירה לבדה אינה נגישה לכל המשתמשים.
 */
export function StopSortableList({
  stops,
  onReorder,
  disabled,
}: {
  stops: SortableStop[];
  onReorder: (orderedIds: string[]) => void;
  disabled?: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const move = (from: number, to: number) => {
    if (to < 0 || to >= stops.length) return;
    const next = [...stops];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onReorder(next.map((stop) => stop.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = stops.findIndex((stop) => stop.id === active.id);
    const to = stops.findIndex((stop) => stop.id === over.id);
    move(from, to);
  };

  if (disabled) {
    return (
      <Stack gap={1}>
        {stops.map((stop, index) => (
          <StopRow key={stop.id} stop={stop} index={index} />
        ))}
      </Stack>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={stops.map((stop) => stop.id)} strategy={verticalListSortingStrategy}>
        <Stack gap={1}>
          {stops.map((stop, index) => (
            <SortableStopRow
              key={stop.id}
              stop={stop}
              index={index}
              onMoveUp={() => move(index, index - 1)}
              onMoveDown={() => move(index, index + 1)}
              isFirst={index === 0}
              isLast={index === stops.length - 1}
            />
          ))}
        </Stack>
      </SortableContext>
    </DndContext>
  );
}

function StopRow({ stop, index }: { stop: SortableStop; index: number }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      gap={1.5}
      sx={{
        p: 1.25,
        border: `1px solid ${palette.border}`,
        borderRadius: radii.control,
        backgroundColor: palette.surface,
      }}
    >
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          backgroundColor: tones.primary.soft,
          color: tones.primary.main,
          fontWeight: 800,
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        {index + 1}
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700 }} noWrap>
          {stop.title}
        </Typography>
        <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }} noWrap>
          {stop.subtitle}
        </Typography>
      </Box>
    </Stack>
  );
}

function SortableStopRow({
  stop,
  index,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  stop: SortableStop;
  index: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stop.id,
  });

  return (
    <Stack
      ref={setNodeRef}
      direction="row"
      alignItems="center"
      gap={1}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      sx={{
        p: 1.25,
        border: `1px solid ${isDragging ? tones.primary.main : palette.border}`,
        borderRadius: radii.control,
        backgroundColor: palette.surface,
        boxShadow: isDragging ? '0 10px 24px rgba(15,23,42,.14)' : 'none',
      }}
    >
      <IconButton
        {...attributes}
        {...listeners}
        aria-label={`גרירת ${stop.title}`}
        size="small"
        sx={{ cursor: 'grab', color: palette.textSecondary }}
      >
        <DragIndicatorRoundedIcon fontSize="small" />
      </IconButton>

      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          backgroundColor: tones.primary.soft,
          color: tones.primary.main,
          fontWeight: 800,
          fontSize: 13,
          flexShrink: 0,
        }}
      >
        {index + 1}
      </Box>

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700 }} noWrap>
          {stop.title}
        </Typography>
        <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }} noWrap>
          {stop.subtitle}
        </Typography>
      </Box>

      <Stack>
        <IconButton size="small" onClick={onMoveUp} disabled={isFirst} aria-label="הזזה למעלה">
          <KeyboardArrowUpRoundedIcon fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={onMoveDown} disabled={isLast} aria-label="הזזה למטה">
          <KeyboardArrowDownRoundedIcon fontSize="small" />
        </IconButton>
      </Stack>
    </Stack>
  );
}

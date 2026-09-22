import { useMemo, useState } from 'react';
import { Box, Button } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import { Link, useNavigate } from 'react-router-dom';
import {
  PackingTaskStatus,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  TaskPriority,
  UserRole,
} from '@south/shared';
import { useBases, useTasks } from '../../api/queries';
import { useAuth } from '../../auth/AuthContext';
import { CardLink, EntityCard } from '../../components/ui/EntityCard';
import { FilterBar } from '../../components/ui/FilterBar';
import { PageHeader } from '../../components/ui/PageHeader';
import { Paginator } from '../../components/ui/Paginator';
import { CardSkeletonGrid, EmptyState, ErrorState } from '../../components/ui/States';
import { formatDateTime } from '../../utils/format';
import { labels, taskTone } from '../../utils/status';

const ALL = 'ALL';

/** רשימת משימות האריזה, מסוננת בשרת לפי תפקיד ותחום הרשאה. */
export function TasksPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>(ALL);
  const [priority, setPriority] = useState<string>(ALL);
  const [baseId, setBaseId] = useState<string>(ALL);

  const { data: bases } = useBases();

  const params = useMemo(
    () => ({
      page,
      pageSize: 12,
      search: search.trim() || undefined,
      status: status === ALL ? undefined : status,
      priority: priority === ALL ? undefined : priority,
      baseId: baseId === ALL ? undefined : baseId,
    }),
    [page, search, status, priority, baseId],
  );

  const { data, isLoading, error, refetch } = useTasks(params);
  const isCommander = user?.role === UserRole.LOGISTICS_COMMANDER;

  const reset = () => {
    setSearch('');
    setStatus(ALL);
    setPriority(ALL);
    setBaseId(ALL);
    setPage(1);
  };

  return (
    <Box>
      <PageHeader
        title={isCommander ? 'משימות אריזה' : 'המשימות שלי'}
        subtitle={
          isCommander
            ? 'כל משימות האריזה במבצע, לפי בסיס, דחיפות וסטטוס'
            : 'המשימות ששויכו אליך לביצוע'
        }
        icon={<AssignmentRoundedIcon />}
        action={
          isCommander ? (
            <Button
              component={Link}
              to="/tasks/new"
              variant="contained"
              startIcon={<AddRoundedIcon />}
              fullWidth
            >
              משימה חדשה
            </Button>
          ) : undefined
        }
      />

      <FilterBar
        search={{
          value: search,
          placeholder: 'חיפוש לפי מספר משימה או חדר מקור...',
          onChange: (value) => {
            setSearch(value);
            setPage(1);
          },
        }}
        filters={[
          {
            id: 'status',
            label: 'סטטוס',
            value: status,
            onChange: (value) => {
              setStatus(value);
              setPage(1);
            },
            options: [
              { value: ALL, label: 'כל הסטטוסים' },
              ...Object.values(PackingTaskStatus).map((value) => ({
                value,
                label: TASK_STATUS_LABEL[value],
              })),
            ],
          },
          {
            id: 'priority',
            label: 'דחיפות',
            value: priority,
            onChange: (value) => {
              setPriority(value);
              setPage(1);
            },
            options: [
              { value: ALL, label: 'כל הדחיפויות' },
              ...TASK_PRIORITIES.map((value: TaskPriority) => ({
                value,
                label: TASK_PRIORITY_LABEL[value],
              })),
            ],
          },
          {
            id: 'base',
            label: 'בסיס מקור',
            value: baseId,
            onChange: (value) => {
              setBaseId(value);
              setPage(1);
            },
            options: [
              { value: ALL, label: 'כל הבסיסים' },
              ...(bases ?? []).map((base) => ({ value: base.id, label: base.name })),
            ],
          },
        ]}
        onReset={reset}
      />

      {isLoading && <CardSkeletonGrid count={6} />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && data.items.length === 0 && (
        <EmptyState
          title="לא נמצאו משימות"
          description="אפשר לנקות את הסינון או ליצור משימה חדשה"
          icon={<AssignmentRoundedIcon fontSize="large" />}
          action={
            isCommander ? (
              <Button component={Link} to="/tasks/new" variant="contained">
                יצירת משימה
              </Button>
            ) : undefined
          }
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' },
            }}
          >
            {data.items.map((task) => (
              <EntityCard
                key={task.id}
                identifier={task.taskNumber}
                title={task.sourceRoomName}
                statusLabel={labels.task[task.status]}
                tone={taskTone[task.status]}
                progress={task.progress.percent}
                icon={<Inventory2RoundedIcon />}
                route={{ from: task.sourceBaseName, to: task.destinationRoomName }}
                onClick={() => navigate(`/tasks/${task.id}`)}
                highlight={task.priority === 'URGENT' && task.status !== 'COMPLETED'}
                meta={[
                  {
                    icon: <PersonRoundedIcon sx={{ fontSize: 15 }} />,
                    label: 'מבצע',
                    value: task.assignedSoldierName,
                  },
                  {
                    icon: <GroupsRoundedIcon sx={{ fontSize: 15 }} />,
                    label: 'צוות',
                    value: task.teamName,
                  },
                  {
                    icon: <EventRoundedIcon sx={{ fontSize: 15 }} />,
                    label: 'יעד לביצוע',
                    value: formatDateTime(task.dueAt),
                  },
                  {
                    icon: <Inventory2RoundedIcon sx={{ fontSize: 15 }} />,
                    label: 'נארז',
                    value: `${task.progress.packedUnits}/${task.progress.totalUnits}`,
                  },
                ]}
                footer={
                  <>
                    <CardLink label="פרטי המשימה" />
                    <CardLink
                      label={`${task.progress.packageCount} אריזות`}
                      icon={<Inventory2RoundedIcon sx={{ fontSize: 15 }} />}
                    />
                  </>
                }
              />
            ))}
          </Box>

          <Paginator
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            itemNoun="משימות"
            onChange={setPage}
          />
        </>
      )}
    </Box>
  );
}

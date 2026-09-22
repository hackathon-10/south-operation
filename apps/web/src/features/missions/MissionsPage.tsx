import { useMemo, useState } from 'react';
import { Box, Button } from '@mui/material';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import { Link, useNavigate } from 'react-router-dom';
import { MISSION_STATUSES, MISSION_STATUS_LABEL, UserRole } from '@south/shared';
import { useMissions } from '../../api/queries';
import { useAuth } from '../../auth/AuthContext';
import { CardLink, EntityCard } from '../../components/ui/EntityCard';
import { FilterBar } from '../../components/ui/FilterBar';
import { PageHeader } from '../../components/ui/PageHeader';
import { Paginator } from '../../components/ui/Paginator';
import { CardSkeletonGrid, EmptyState, ErrorState } from '../../components/ui/States';
import { formatDateTime, formatKm } from '../../utils/format';
import { MISSION_PROGRESS, labels, missionTone } from '../../utils/status';

const ALL = 'ALL';

/** רשימת השליחויות. חייל רואה שליחויות שלו או כאלה שעוברות בבסיס שלו. */
export function MissionsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>(ALL);

  const isCommander = user?.role === UserRole.LOGISTICS_COMMANDER;

  const params = useMemo(
    () => ({ page, pageSize: 12, status: status === ALL ? undefined : status }),
    [page, status],
  );

  const { data, isLoading, error, refetch } = useMissions(params);

  return (
    <Box>
      <PageHeader
        title="שליחויות"
        subtitle="תכנון, העמסה, יציאה וקליטה של שליחויות בין הבסיסים לקריית התקשוב"
        icon={<LocalShippingRoundedIcon />}
        action={
          isCommander ? (
            <Button
              component={Link}
              to="/missions/new"
              variant="contained"
              startIcon={<RouteRoundedIcon />}
              fullWidth
            >
              שליחות חדשה
            </Button>
          ) : undefined
        }
      />

      <FilterBar
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
              ...MISSION_STATUSES.map((value) => ({
                value,
                label: MISSION_STATUS_LABEL[value],
              })),
            ],
          },
        ]}
        onReset={() => {
          setStatus(ALL);
          setPage(1);
        }}
      />

      {isLoading && <CardSkeletonGrid count={4} />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && data.items.length === 0 && (
        <EmptyState
          title="אין שליחויות להצגה"
          description={
            isCommander
              ? 'אפשר לתכנן שליחות חדשה מתוך האריזות המוכנות לשילוח'
              : 'ברגע שתשויך שליחות אליך או לבסיס שלך היא תופיע כאן'
          }
          icon={<LocalShippingRoundedIcon fontSize="large" />}
          action={
            isCommander ? (
              <Button component={Link} to="/missions/new" variant="contained">
                תכנון שליחות
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
            {data.items.map((mission) => (
              <EntityCard
                key={mission.id}
                identifier={mission.missionNumber}
                title={mission.title}
                statusLabel={labels.mission[mission.status]}
                tone={missionTone[mission.status]}
                progress={MISSION_PROGRESS[mission.status]}
                icon={<LocalShippingRoundedIcon />}
                route={{
                  from: mission.pickupBaseNames[0] ?? 'קריית התקשוב',
                  to: 'קריית התקשוב',
                }}
                onClick={() => navigate(`/missions/${mission.id}`)}
                meta={[
                  {
                    icon: <EventRoundedIcon sx={{ fontSize: 15 }} />,
                    label: 'יציאה',
                    value: formatDateTime(mission.plannedDepartureAt),
                  },
                  {
                    icon: <PersonRoundedIcon sx={{ fontSize: 15 }} />,
                    label: 'מבצע',
                    value: mission.assignedSoldierName ?? 'טרם שויך',
                  },
                  {
                    icon: <Inventory2RoundedIcon sx={{ fontSize: 15 }} />,
                    label: 'אריזות',
                    value: `${mission.loadedPackageCount}/${mission.packageCount} הועמסו`,
                  },
                  {
                    icon: <RouteRoundedIcon sx={{ fontSize: 15 }} />,
                    label: 'מסלול',
                    value: `${mission.stopCount} עצירות · ${formatKm(mission.routeDistanceKmEstimate)}`,
                  },
                ]}
                footer={
                  <>
                    <CardLink label="פרטי השליחות" />
                    {mission.requiresSecuredTransport && (
                      <CardLink
                        label="נסיעה מאובטחת"
                        icon={<ShieldRoundedIcon sx={{ fontSize: 15 }} />}
                      />
                    )}
                  </>
                }
              />
            ))}
          </Box>

          <Paginator
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            itemNoun="שליחויות"
            onChange={setPage}
          />
        </>
      )}
    </Box>
  );
}

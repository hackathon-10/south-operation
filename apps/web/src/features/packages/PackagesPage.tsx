import { useMemo, useState } from 'react';
import { Box, Button, Card, Divider, Stack, Typography } from '@mui/material';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import QrCodeRoundedIcon from '@mui/icons-material/QrCodeRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import MeetingRoomRoundedIcon from '@mui/icons-material/MeetingRoomRounded';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PACKAGE_STATUSES, PACKAGE_STATUS_LABEL, UserRole } from '@south/shared';
import { useBases, usePackages, useTeams } from '../../api/queries';
import { useAuth } from '../../auth/AuthContext';
import { CardLink, EntityCard } from '../../components/ui/EntityCard';
import { FilterBar } from '../../components/ui/FilterBar';
import { PageHeader } from '../../components/ui/PageHeader';
import { Paginator } from '../../components/ui/Paginator';
import { CardSkeletonGrid, EmptyState, ErrorState } from '../../components/ui/States';
import { SoftBadge } from '../../components/ui/StatusBadge';
import { palette } from '../../theme/tokens';
import { formatDateTime } from '../../utils/format';
import { PACKAGE_PROGRESS, labels, packageTone } from '../../utils/status';

const ALL = 'ALL';

/** רשימת האריזות - "מאגר האריזות" של המשתמש, לפי תחום ההרשאה שלו. */
export function PackagesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>(searchParams.get('status') ?? ALL);
  const [teamId, setTeamId] = useState<string>(ALL);
  const [baseId, setBaseId] = useState<string>(ALL);
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const { data: teams } = useTeams();
  const { data: bases } = useBases();

  const params = useMemo(
    () => ({
      page,
      pageSize: 12,
      search: search.trim() || undefined,
      status: status === ALL ? undefined : status,
      teamId: teamId === ALL ? undefined : teamId,
      baseId: baseId === ALL ? undefined : baseId,
    }),
    [page, search, status, teamId, baseId],
  );

  const { data, isLoading, error, refetch } = usePackages(params);
  const isTeamLead = user?.role === UserRole.TEAM_LEAD;

  const reset = () => {
    setSearch('');
    setStatus(ALL);
    setTeamId(ALL);
    setBaseId(ALL);
    setPage(1);
  };

  return (
    <Box>
      <PageHeader
        title={isTeamLead ? 'אריזות הצוות' : 'אריזות'}
        subtitle={
          isTeamLead
            ? 'כל הציוד של הצוות, כולל מחשבים ומסכים לפי בעלים'
            : 'כל האריזות, מפתיחה ועד הגעה לחדר היעד'
        }
        icon={<Inventory2RoundedIcon />}
      />

      <FilterBar
        search={{
          value: search,
          placeholder: 'חיפוש לפי מספר אריזה, מזהה מחשב או שם בעלים...',
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
              ...PACKAGE_STATUSES.map((value) => ({
                value,
                label: PACKAGE_STATUS_LABEL[value],
              })),
            ],
          },
          {
            id: 'team',
            label: 'צוות',
            value: teamId,
            onChange: (value) => {
              setTeamId(value);
              setPage(1);
            },
            options: [
              { value: ALL, label: 'כל הצוותים' },
              ...(teams ?? []).map((team) => ({ value: team.id, label: team.name })),
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
        view={{ value: view, onChange: setView }}
      />

      {isLoading && <CardSkeletonGrid count={6} />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && data.items.length === 0 && (
        <EmptyState
          title="לא נמצאו אריזות"
          description="אפשר לנקות את הסינון ולנסות שוב"
          icon={<Inventory2RoundedIcon fontSize="large" />}
        />
      )}

      {data && data.items.length > 0 && view === 'grid' && (
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' },
          }}
        >
          {data.items.map((pkg) => (
            <EntityCard
              key={pkg.id}
              identifier={pkg.packageNumber}
              title={`${pkg.itemLineCount} שורות · ${pkg.totalUnits} יחידות`}
              statusLabel={labels.package[pkg.status]}
              tone={packageTone[pkg.status]}
              progress={PACKAGE_PROGRESS[pkg.status]}
              icon={<QrCodeRoundedIcon />}
              route={{ from: pkg.sourceBaseName, to: `חדר ${pkg.destination.roomNumber}` }}
              onClick={() => navigate(`/packages/${pkg.id}`)}
              meta={[
                {
                  icon: <GroupsRoundedIcon sx={{ fontSize: 15 }} />,
                  label: 'צוות',
                  value: pkg.teamName,
                },
                {
                  icon: <MeetingRoomRoundedIcon sx={{ fontSize: 15 }} />,
                  label: 'יעד',
                  value: `קומה ${pkg.destination.floor} · ${pkg.destinationRoomName}`,
                },
                {
                  icon: <PersonRoundedIcon sx={{ fontSize: 15 }} />,
                  label: 'אחראי',
                  value: pkg.responsibleUserName,
                },
                {
                  icon: <EventRoundedIcon sx={{ fontSize: 15 }} />,
                  label: 'נסגרה',
                  value: formatDateTime(pkg.sealedAt),
                },
              ]}
              footer={
                <>
                  <CardLink label="פרטי האריזה" />
                  {pkg.missionNumber && (
                    <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }}>
                      שליחות {pkg.missionNumber}
                    </Typography>
                  )}
                </>
              }
            />
          ))}
        </Box>
      )}

      {data && data.items.length > 0 && view === 'list' && (
        <Card>
          <Stack divider={<Divider />}>
            {data.items.map((pkg) => (
              <Stack
                key={pkg.id}
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                gap={1.5}
                onClick={() => navigate(`/packages/${pkg.id}`)}
                sx={{ px: 2, py: 1.5, cursor: 'pointer', '&:hover': { backgroundColor: palette.surfaceMuted } }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 14.5, fontWeight: 700 }} dir="ltr" textAlign="start">
                    {pkg.packageNumber}
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }} noWrap>
                    {pkg.sourceBaseName} · {pkg.sourceRoomName} ← קומה {pkg.destination.floor} · חדר{' '}
                    {pkg.destination.roomNumber} · {pkg.teamName}
                  </Typography>
                </Box>
                <Stack direction="row" alignItems="center" gap={1.5}>
                  <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }}>
                    {pkg.totalUnits} יחידות
                  </Typography>
                  <SoftBadge label={labels.package[pkg.status]} tone={packageTone[pkg.status]} />
                </Stack>
              </Stack>
            ))}
          </Stack>
        </Card>
      )}

      {data && (
        <Paginator
          page={data.page}
          totalPages={data.totalPages}
          total={data.total}
          itemNoun="אריזות"
          onChange={setPage}
        />
      )}

      {isTeamLead && (
        <Button sx={{ mt: 2 }} onClick={() => navigate('/scan')}>
          סריקת QR של אריזה
        </Button>
      )}
    </Box>
  );
}

import { useMemo, useState } from 'react';
import { Box, Card, Chip, Divider, Stack, Typography } from '@mui/material';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import { AUDIT_ACTION_LABEL, AuditAction } from '@south/shared';
import { useAuditLogs } from '../../api/queries';
import { FilterBar } from '../../components/ui/FilterBar';
import { PageHeader } from '../../components/ui/PageHeader';
import { Paginator } from '../../components/ui/Paginator';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/ui/States';
import { palette, tones } from '../../theme/tokens';
import { formatDateTime } from '../../utils/format';

const ALL = 'ALL';

const ENTITY_LABELS: Record<string, string> = {
  User: 'משתמש',
  PackingTask: 'משימת אריזה',
  Package: 'אריזה',
  TransportMission: 'שליחות',
  MissionStop: 'עצירה',
  MissionJoinRequest: 'בקשת הצטרפות',
};

/** יומן הפעולות - מיועד למפקד הלוגיסטיקה בלבד (§7.16). */
export function AuditPage() {
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState<string>(ALL);
  const [action, setAction] = useState<string>(ALL);

  const params = useMemo(
    () => ({
      page,
      pageSize: 25,
      entityType: entityType === ALL ? undefined : entityType,
      action: action === ALL ? undefined : action,
    }),
    [page, entityType, action],
  );

  const { data, isLoading, error, refetch } = useAuditLogs(params);

  return (
    <Box>
      <PageHeader
        title="יומן פעולות"
        subtitle="תיעוד הפעולות המשמעותיות במערכת - מי עשה מה ומתי"
        icon={<HistoryRoundedIcon />}
      />

      <FilterBar
        filters={[
          {
            id: 'entity',
            label: 'סוג ישות',
            value: entityType,
            onChange: (value) => {
              setEntityType(value);
              setPage(1);
            },
            options: [
              { value: ALL, label: 'כל הישויות' },
              ...Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label })),
            ],
          },
          {
            id: 'action',
            label: 'פעולה',
            value: action,
            onChange: (value) => {
              setAction(value);
              setPage(1);
            },
            options: [
              { value: ALL, label: 'כל הפעולות' },
              ...Object.keys(AUDIT_ACTION_LABEL).map((value) => ({
                value,
                label: AUDIT_ACTION_LABEL[value as AuditAction],
              })),
            ],
          },
        ]}
        onReset={() => {
          setEntityType(ALL);
          setAction(ALL);
          setPage(1);
        }}
      />

      {isLoading && <ListSkeleton rows={8} />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && data.items.length === 0 && (
        <EmptyState title="אין רשומות ביומן" description="אפשר לנקות את הסינון ולנסות שוב" />
      )}

      {data && data.items.length > 0 && (
        <>
          <Card>
            <Stack divider={<Divider />}>
              {data.items.map((log) => (
                <Stack
                  key={log.id}
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  gap={1}
                  sx={{ px: 2, py: 1.5 }}
                >
                  <Stack direction="row" alignItems="center" gap={1.5} sx={{ minWidth: 0 }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: log.action.includes('FAILED')
                          ? tones.danger.main
                          : tones.primary.main,
                        flexShrink: 0,
                      }}
                      aria-hidden="true"
                    />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
                        {log.actionLabel}
                      </Typography>
                      <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }} noWrap>
                        {log.actorName ?? 'מערכת'} ·{' '}
                        {ENTITY_LABELS[log.entityType] ?? log.entityType}
                      </Typography>
                    </Box>
                  </Stack>

                  <Stack direction="row" alignItems="center" gap={1}>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <Chip
                        size="small"
                        variant="outlined"
                        label={summarizeMetadata(log.metadata)}
                      />
                    )}
                    <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }}>
                      {formatDateTime(log.createdAt)}
                    </Typography>
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </Card>

          <Paginator
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            itemNoun="רשומות"
            onChange={setPage}
          />
        </>
      )}
    </Box>
  );
}

function summarizeMetadata(metadata: Record<string, unknown>): string {
  const entries = Object.entries(metadata).slice(0, 2);
  return entries
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? '…' : String(value)}`)
    .join(' · ');
}

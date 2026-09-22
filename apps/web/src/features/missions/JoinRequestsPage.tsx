import { useState } from 'react';
import { Alert, Box, Button, Card, Chip, Divider, Stack, Typography } from '@mui/material';
import RuleFolderRoundedIcon from '@mui/icons-material/RuleFolderRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { Link } from 'react-router-dom';
import { JoinRequestStatus } from '@south/shared';
import { useJoinRequests, useReviewJoinRequest } from '../../api/queries';
import { toUserError } from '../../api/errors';
import { PageHeader } from '../../components/ui/PageHeader';
import { SoftBadge } from '../../components/ui/StatusBadge';
import { EmptyState, ErrorState, ListSkeleton } from '../../components/ui/States';
import { palette } from '../../theme/tokens';
import { formatDateTime } from '../../utils/format';
import { joinRequestTone, labels, packageTone } from '../../utils/status';

/** אישור או דחייה של בקשות להוספת עצירת איסוף לשליחות (§8.7). */
export function JoinRequestsPage() {
  const [statusFilter, setStatusFilter] = useState<string>(JoinRequestStatus.PENDING);
  const { data, isLoading, error, refetch } = useJoinRequests({
    status: statusFilter,
    pageSize: 50,
  });
  const approve = useReviewJoinRequest('approve');
  const reject = useReviewJoinRequest('reject');
  const [actionError, setActionError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await action();
    } catch (failure) {
      const details = toUserError(failure);
      setActionError(details.hint ? `${details.message}. ${details.hint}` : details.message);
    }
  };

  return (
    <Box>
      <PageHeader
        title="בקשות הצטרפות לשליחות"
        subtitle="חיילים בבסיסים מבקשים לצרף אריזות מוכנות לשליחות מתוכננת"
        icon={<RuleFolderRoundedIcon />}
      />

      <Stack direction="row" gap={1} sx={{ mb: 2.5, flexWrap: 'wrap' }}>
        {[
          { value: JoinRequestStatus.PENDING, label: 'ממתינות' },
          { value: JoinRequestStatus.APPROVED, label: 'אושרו' },
          { value: JoinRequestStatus.REJECTED, label: 'נדחו' },
        ].map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            onClick={() => setStatusFilter(option.value)}
            color={statusFilter === option.value ? 'primary' : 'default'}
            variant={statusFilter === option.value ? 'filled' : 'outlined'}
          />
        ))}
      </Stack>

      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      {isLoading && <ListSkeleton rows={3} />}
      {error && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && data.items.length === 0 && (
        <EmptyState
          title="אין בקשות להצגה"
          description="כשחייל יבקש לצרף אריזות לשליחות, הבקשה תופיע כאן לאישור"
          icon={<RuleFolderRoundedIcon fontSize="large" />}
        />
      )}

      <Stack gap={2}>
        {(data?.items ?? []).map((request) => (
          <Card key={request.id} sx={{ p: 2.5 }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              justifyContent="space-between"
              gap={1.5}
            >
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 0.5 }}>
                  <SoftBadge
                    label={labels.joinRequest[request.status]}
                    tone={joinRequestTone[request.status]}
                  />
                  <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }}>
                    {formatDateTime(request.createdAt)}
                  </Typography>
                </Stack>

                <Typography sx={{ fontSize: 16, fontWeight: 700 }}>
                  {request.requestingUserName} · {request.baseName}
                </Typography>
                <Typography
                  component={Link}
                  to={`/missions/${request.transportMissionId}`}
                  sx={{ fontSize: 13.5, color: palette.textSecondary, textDecoration: 'none' }}
                >
                  לשליחות {request.missionNumber} · {request.missionTitle}
                </Typography>

                {request.note && (
                  <Typography sx={{ fontSize: 13, mt: 1 }}>״{request.note}״</Typography>
                )}
              </Box>

              {request.status === JoinRequestStatus.PENDING && (
                <Stack direction="row" gap={1} sx={{ flexShrink: 0 }}>
                  <Button
                    variant="contained"
                    startIcon={<CheckRoundedIcon />}
                    disabled={approve.isPending}
                    onClick={() => run(() => approve.mutateAsync({ requestId: request.id }))}
                  >
                    אישור
                  </Button>
                  <Button
                    color="error"
                    startIcon={<CloseRoundedIcon />}
                    disabled={reject.isPending}
                    onClick={() => run(() => reject.mutateAsync({ requestId: request.id }))}
                  >
                    דחייה
                  </Button>
                </Stack>
              )}
            </Stack>

            <Divider sx={{ my: 1.5 }} />

            <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1 }}>
              אריזות בבקשה ({request.packages.length})
            </Typography>
            <Stack gap={0.75}>
              {request.packages.map((pkg) => (
                <Stack
                  key={pkg.packageId}
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  gap={1}
                >
                  <Typography sx={{ fontSize: 13.5, fontWeight: 600 }} dir="ltr" textAlign="start">
                    {pkg.packageNumber}
                  </Typography>
                  <Stack direction="row" alignItems="center" gap={1}>
                    <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }}>
                      {pkg.teamName} · {pkg.totalUnits} יחידות
                    </Typography>
                    <SoftBadge label={labels.package[pkg.status]} tone={packageTone[pkg.status]} />
                  </Stack>
                </Stack>
              ))}
            </Stack>

            {request.reviewedByName && (
              <Typography sx={{ fontSize: 12.5, color: palette.textSecondary, mt: 1.5 }}>
                טופלה על ידי {request.reviewedByName} · {formatDateTime(request.reviewedAt)}
              </Typography>
            )}
          </Card>
        ))}
      </Stack>
    </Box>
  );
}

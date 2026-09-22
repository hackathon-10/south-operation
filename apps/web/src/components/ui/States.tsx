import { Box, Button, Card, Skeleton, Stack, Typography } from '@mui/material';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InboxRoundedIcon from '@mui/icons-material/InboxRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import type { ReactNode } from 'react';
import { palette, tones } from '../../theme/tokens';
import { toUserError } from '../../api/errors';

/** מצב ריק - מסביר מה אין ומה אפשר לעשות. */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Card sx={{ p: 4, textAlign: 'center' }}>
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          backgroundColor: palette.slateSoft,
          color: palette.textSecondary,
          mx: 'auto',
          mb: 2,
        }}
        aria-hidden="true"
      >
        {icon ?? <InboxRoundedIcon fontSize="large" />}
      </Box>
      <Typography sx={{ fontSize: 17, fontWeight: 700 }}>{title}</Typography>
      {description && (
        <Typography sx={{ fontSize: 14, color: palette.textSecondary, mt: 0.5, maxWidth: 440, mx: 'auto' }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 2.5 }}>{action}</Box>}
    </Card>
  );
}

/**
 * מצב שגיאה - מציג הודעה אנושית בעברית ופעולה אפשרית.
 * לעולם לא מוצג קוד HTTP למשתמש (§11).
 */
export function ErrorState({
  error,
  onRetry,
  title,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  const details = toUserError(error);

  return (
    <Card sx={{ p: 4, textAlign: 'center', borderColor: tones.danger.soft }}>
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          backgroundColor: tones.danger.soft,
          color: tones.danger.main,
          mx: 'auto',
          mb: 2,
        }}
        aria-hidden="true"
      >
        <ErrorOutlineRoundedIcon fontSize="large" />
      </Box>
      <Typography sx={{ fontSize: 17, fontWeight: 700 }}>{title ?? details.message}</Typography>
      {details.hint && (
        <Typography sx={{ fontSize: 14, color: palette.textSecondary, mt: 0.5 }}>
          {details.hint}
        </Typography>
      )}
      {onRetry && (
        <Button variant="contained" onClick={onRetry} sx={{ mt: 2.5 }}>
          נסו שוב
        </Button>
      )}
    </Card>
  );
}

export function SuccessState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Card sx={{ p: 4, textAlign: 'center', backgroundColor: tones.success.soft, borderColor: 'transparent' }}>
      <CheckCircleRoundedIcon sx={{ fontSize: 56, color: tones.success.main }} />
      <Typography sx={{ fontSize: 19, fontWeight: 800, mt: 1 }}>{title}</Typography>
      {description && (
        <Typography sx={{ fontSize: 14, color: palette.textSecondary, mt: 0.5 }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 2.5 }}>{action}</Box>}
    </Card>
  );
}

/** שלד טעינה בצורת הכרטיסים עצמם, כדי שהמעבר לתוכן לא "יקפוץ". */
export function CardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1fr' },
      }}
    >
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Skeleton variant="rounded" width={72} height={22} />
            <Skeleton variant="circular" width={46} height={46} />
          </Stack>
          <Skeleton variant="text" width="40%" sx={{ mt: 1.5 }} />
          <Skeleton variant="text" width="70%" />
          <Skeleton variant="text" width="55%" />
          <Skeleton variant="rounded" height={52} sx={{ mt: 1.5 }} />
        </Card>
      ))}
    </Box>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Stack gap={1.5}>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} variant="rounded" height={64} />
      ))}
    </Stack>
  );
}

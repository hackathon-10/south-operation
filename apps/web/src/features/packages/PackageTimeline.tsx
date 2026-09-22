import { Box, Card, Stack, Typography } from '@mui/material';
import type { PackageStatusEventDto } from '@south/shared';
import { palette, tones } from '../../theme/tokens';
import { formatDateTime } from '../../utils/format';
import { labels, packageTone } from '../../utils/status';

/** ציר הזמן של האריזה - נבנה מאירועי הסטטוס שנשמרים בשרת (§7.17). */
export function PackageTimeline({ events }: { events: PackageStatusEventDto[] }) {
  return (
    <Card sx={{ p: 2.5 }}>
      <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 2 }}>ציר זמן</Typography>

      {events.length === 0 ? (
        <Typography sx={{ fontSize: 13.5, color: palette.textSecondary }}>
          אין עדיין אירועים לאריזה הזו
        </Typography>
      ) : (
        <Stack sx={{ position: 'relative' }}>
          <Box
            aria-hidden="true"
            sx={{
              position: 'absolute',
              insetInlineStart: 11,
              top: 8,
              bottom: 8,
              width: 2,
              backgroundColor: palette.border,
            }}
          />
          {events.map((event) => {
            const tone = tones[packageTone[event.toStatus]];
            return (
              <Stack key={event.id} direction="row" gap={1.5} sx={{ position: 'relative', pb: 2.5 }}>
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    backgroundColor: tone.soft,
                    border: `2px solid ${tone.main}`,
                    flexShrink: 0,
                    zIndex: 1,
                  }}
                  aria-hidden="true"
                />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
                    {labels.package[event.toStatus]}
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }}>
                    {formatDateTime(event.createdAt)} · {event.actorName}
                    {event.missionNumber ? ` · שליחות ${event.missionNumber}` : ''}
                  </Typography>
                  {event.note && (
                    <Typography sx={{ fontSize: 12.5, color: palette.textPrimary, mt: 0.25 }}>
                      {event.note}
                    </Typography>
                  )}
                </Box>
              </Stack>
            );
          })}
        </Stack>
      )}
    </Card>
  );
}

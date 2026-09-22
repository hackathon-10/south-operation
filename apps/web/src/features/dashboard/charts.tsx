import { Box, Typography } from '@mui/material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { palette, tones } from '../../theme/tokens';

/**
 * גרפים פשוטים בלבד, ורק כשהם עוזרים להבנה (§10.3).
 *
 * החלטת עיצוב: שני הגרפים הם סדרה אחת בגוון אחד, והזהות מגיעה מתוויות הציר -
 * כך אין הסתמכות על צבע להבחנה בין קטגוריות, וזה נשאר קריא גם לעיוורי צבעים.
 * תווית הערך מוצגת ישירות על כל עמודה, ולכן אין צורך במקרא.
 */

interface BarDatum {
  label: string;
  value: number;
  suffix?: string;
}

function ChartTooltip({
  active,
  payload,
  suffix,
}: {
  active?: boolean;
  payload?: Array<{ payload: BarDatum }>;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  const datum = payload[0].payload;
  return (
    <Box
      sx={{
        backgroundColor: palette.navy800,
        color: '#fff',
        px: 1.25,
        py: 0.75,
        borderRadius: 1.5,
        fontSize: 12.5,
      }}
    >
      <strong>{datum.label}</strong>
      <br />
      {datum.value.toLocaleString('he-IL')}
      {suffix ?? ''}
    </Box>
  );
}

export function HorizontalBarChart({
  data,
  suffix = '',
  height = 240,
  emptyLabel = 'אין נתונים להצגה',
  highlightIndex,
}: {
  data: BarDatum[];
  suffix?: string;
  height?: number;
  emptyLabel?: string;
  highlightIndex?: number;
}) {
  const hasValues = data.some((item) => item.value > 0);

  if (!hasValues) {
    return (
      <Box sx={{ height, display: 'grid', placeItems: 'center' }}>
        <Typography sx={{ fontSize: 13.5, color: palette.textSecondary }}>{emptyLabel}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height, direction: 'ltr' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 44, bottom: 4, left: 4 }}>
          <CartesianGrid horizontal={false} stroke={palette.border} />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={128}
            axisLine={false}
            tickLine={false}
            orientation="right"
            tick={{ fontSize: 12.5, fill: palette.textSecondary, textAnchor: 'start' }}
          />
          <Tooltip
            cursor={{ fill: palette.surfaceMuted }}
            content={<ChartTooltip suffix={suffix} />}
          />
          <Bar dataKey="value" radius={[4, 4, 4, 4]} barSize={14} isAnimationActive={false}>
            {data.map((item, index) => (
              <Cell
                key={item.label}
                fill={index === highlightIndex ? tones.success.main : tones.primary.main}
              />
            ))}
            <LabelList
              dataKey="value"
              position="left"
              formatter={(value: number) => `${value.toLocaleString('he-IL')}${suffix}`}
              style={{ fontSize: 12, fontWeight: 700, fill: palette.textPrimary }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}

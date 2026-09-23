import { Box, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { palette, tones, type ToneName } from '../../theme/tokens';

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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  // במובייל עמודת התוויות חייבת להיות צרה יותר, אחרת כמעט לא נשאר רוחב לעמודות
  // עצמן. שולי השמאל מפנים מקום לתווית הערך, שאחרת נחתכת בקצה.
  const axisWidth = isMobile ? 104 : 148;
  const chartMargin = { top: 4, right: isMobile ? 16 : 44, bottom: 4, left: 34 };

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
        <BarChart data={data} layout="vertical" margin={chartMargin}>
          <CartesianGrid horizontal={false} stroke={palette.border} />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={axisWidth}
            axisLine={false}
            tickLine={false}
            orientation="right"
            tick={{ fontSize: isMobile ? 11.5 : 12.5, fill: palette.textSecondary, textAnchor: 'end' }}
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

export interface DonutDatum {
  label: string;
  value: number;
  tone: ToneName;
}

function DonutTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{ payload: DonutDatum }>;
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const datum = payload[0].payload;
  const percent = total === 0 ? 0 : Math.round((datum.value / total) * 100);
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
      {datum.value.toLocaleString('he-IL')} ({percent}%)
    </Box>
  );
}

/**
 * "דונאט" עם מספר מרכזי - לתמונת מאקרו של מפקד המבצע (§10.6).
 *
 * הזהות בין הפלחים לעולם אינה נשענת על צבע בלבד: המקרא שמתחת מציג תווית
 * וספירה לכל קטגוריה, כנדרש כשחלק מהגוונים (למשל כתום החיווי) אינם עומדים
 * בניגודיות מלאה מול הרקע הבהיר.
 */
export function DonutChart({
  data,
  height = 200,
  centerLabel,
  emptyLabel = 'אין נתונים להצגה',
}: {
  data: DonutDatum[];
  height?: number;
  centerLabel?: string;
  emptyLabel?: string;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <Box sx={{ height, display: 'grid', placeItems: 'center' }}>
        <Typography sx={{ fontSize: 13.5, color: palette.textSecondary }}>{emptyLabel}</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ position: 'relative', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={2}
              cornerRadius={4}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((item) => (
                <Cell key={item.label} fill={tones[item.tone].main} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip total={total} />} />
          </PieChart>
        </ResponsiveContainer>
        <Box
          aria-hidden="true"
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <Typography sx={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>{total}</Typography>
          {centerLabel && (
            <Typography sx={{ fontSize: 11.5, color: palette.textSecondary, mt: 0.25 }}>
              {centerLabel}
            </Typography>
          )}
        </Box>
      </Box>

      <Stack direction="row" flexWrap="wrap" gap={1.25} sx={{ mt: 2 }}>
        {data.map((item) => (
          <Stack key={item.label} direction="row" alignItems="center" gap={0.75}>
            <Box
              aria-hidden="true"
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: tones[item.tone].main,
                flexShrink: 0,
              }}
            />
            <Typography sx={{ fontSize: 12.5, color: palette.textSecondary }}>
              {item.label} <strong style={{ color: palette.textPrimary }}>{item.value}</strong>
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

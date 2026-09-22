import { Box, Typography } from '@mui/material';
import { palette, tones, type ToneName } from '../../theme/tokens';

interface ProgressRingProps {
  value: number;
  tone?: ToneName;
  size?: number;
  thickness?: number;
  label?: string;
}

/**
 * טבעת התקדמות עם אחוז במרכז.
 * ממומשת ב-SVG כדי לשלוט בעובי ובצבע ולשמור על נגישות.
 */
export function ProgressRing({
  value,
  tone = 'primary',
  size = 46,
  thickness = 4,
  label,
}: ProgressRingProps) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - safeValue / 100);
  const color = tones[tone].main;

  return (
    <Box
      sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
      role="img"
      aria-label={label ?? `התקדמות ${safeValue} אחוזים`}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={palette.slateSoft}
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography sx={{ fontSize: size * 0.26, fontWeight: 700, color: palette.textPrimary }}>
          {safeValue}%
        </Typography>
      </Box>
    </Box>
  );
}

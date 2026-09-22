/**
 * אסימוני העיצוב של המערכת - מקור אמת יחיד לצבע, מרווח, רדיוס וצל.
 * החלפת ערכת צבעים (למשל למיתוג אחר) נעשית כאן בלבד.
 * מתועד ב-docs/design/design-language.md.
 */

export const palette = {
  navy900: '#0B1A2E',
  navy800: '#11253D',
  navy700: '#1B3A5C',
  navy600: '#27507B',

  canvas: '#F2F5F9',
  surface: '#FFFFFF',
  surfaceMuted: '#F7F9FC',
  border: '#E3E9F0',
  borderStrong: '#CFD8E3',

  primary: '#2F6FED',
  primaryDark: '#1F55C4',
  primarySoft: '#E8F0FE',

  success: '#16A34A',
  successSoft: '#E7F6EC',
  warning: '#F59E0B',
  warningSoft: '#FEF3DC',
  danger: '#E5484D',
  dangerSoft: '#FDECEC',
  info: '#3B82F6',
  infoSoft: '#E8F1FE',
  violet: '#7C5CFC',
  violetSoft: '#EFEBFF',
  slate: '#64748B',
  slateSoft: '#EEF2F7',

  textPrimary: '#0F1E32',
  textSecondary: '#64748B',
  textInverse: '#FFFFFF',
} as const;

export type ToneName = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'slate';

export const tones: Record<ToneName, { main: string; soft: string; contrast: string }> = {
  primary: { main: palette.primary, soft: palette.primarySoft, contrast: '#FFFFFF' },
  success: { main: palette.success, soft: palette.successSoft, contrast: '#FFFFFF' },
  warning: { main: palette.warning, soft: palette.warningSoft, contrast: '#3A2A00' },
  danger: { main: palette.danger, soft: palette.dangerSoft, contrast: '#FFFFFF' },
  info: { main: palette.info, soft: palette.infoSoft, contrast: '#FFFFFF' },
  violet: { main: palette.violet, soft: palette.violetSoft, contrast: '#FFFFFF' },
  slate: { main: palette.slate, soft: palette.slateSoft, contrast: '#FFFFFF' },
};

export const radii = {
  card: 14,
  control: 10,
  pill: 999,
  panel: 18,
} as const;

export const shadows = {
  card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.06)',
  raised: '0 12px 32px rgba(15, 23, 42, 0.12)',
  topbar: '0 1px 0 rgba(255, 255, 255, 0.06)',
} as const;

export const layout = {
  maxContentWidth: 1440,
  sidebarWidth: 248,
  sidebarCollapsedWidth: 76,
  topBarHeight: 64,
  bottomNavHeight: 64,
  gutterDesktop: 24,
  gutterMobile: 16,
} as const;

export const fontFamily = "'Assistant', 'Heebo', 'Rubik', system-ui, -apple-system, sans-serif";

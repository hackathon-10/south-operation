import { createTheme } from '@mui/material/styles';
import { fontFamily, palette, radii, shadows } from './tokens';

/**
 * ערכת הנושא של המערכת: RTL מלא, טיפוגרפיה עברית וכרטיסים רכים,
 * לפי שפת העיצוב שב-docs/design/design-language.md.
 */
export const theme = createTheme({
  direction: 'rtl',
  palette: {
    mode: 'light',
    primary: { main: palette.primary, dark: palette.primaryDark, light: palette.primarySoft },
    secondary: { main: palette.navy700 },
    success: { main: palette.success },
    warning: { main: palette.warning },
    error: { main: palette.danger },
    info: { main: palette.info },
    background: { default: palette.canvas, paper: palette.surface },
    text: { primary: palette.textPrimary, secondary: palette.textSecondary },
    divider: palette.border,
  },
  shape: { borderRadius: radii.control },
  typography: {
    fontFamily,
    h1: { fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.01em' },
    h2: { fontSize: '1.75rem', fontWeight: 700 },
    h3: { fontSize: '1.5rem', fontWeight: 700 },
    h4: { fontSize: '1.25rem', fontWeight: 700 },
    h5: { fontSize: '1.0625rem', fontWeight: 700 },
    h6: { fontSize: '0.9375rem', fontWeight: 700 },
    subtitle1: { fontSize: '0.9375rem', fontWeight: 600 },
    subtitle2: { fontSize: '0.8125rem', fontWeight: 600, color: palette.textSecondary },
    body1: { fontSize: '0.9375rem' },
    body2: { fontSize: '0.8125rem' },
    button: { fontWeight: 700, textTransform: 'none', fontSize: '0.9375rem' },
    caption: { fontSize: '0.75rem' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: palette.canvas,
          color: palette.textPrimary,
          WebkitFontSmoothing: 'antialiased',
        },
        '*:focus-visible': {
          outline: `3px solid ${palette.primary}`,
          outlineOffset: 2,
        },
        '@media print': {
          'body *': { visibility: 'hidden' },
          '#print-area, #print-area *': { visibility: 'visible' },
          '#print-area': { position: 'absolute', inset: 0, margin: 0 },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: radii.card },
        elevation0: { boxShadow: 'none' },
        elevation1: { boxShadow: shadows.card },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: radii.card,
          border: `1px solid ${palette.border}`,
          boxShadow: shadows.card,
          backgroundColor: palette.surface,
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: radii.control, minHeight: 44, paddingInline: 18 },
        sizeLarge: { minHeight: 52, fontSize: '1rem' },
        containedPrimary: {
          boxShadow: '0 6px 16px rgba(47, 111, 237, 0.24)',
          '&:hover': { backgroundColor: palette.primaryDark },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: radii.pill, fontWeight: 700, fontSize: '0.75rem' },
      },
    },
    MuiTextField: { defaultProps: { size: 'small' } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: radii.control, backgroundColor: palette.surface },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { fontSize: '0.75rem', backgroundColor: palette.navy800, borderRadius: 8 },
      },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: radii.panel } },
    },
    MuiDrawer: {
      styleOverrides: { paper: { borderRadius: 0 } },
    },
    MuiTableCell: {
      styleOverrides: {
        head: { fontWeight: 700, backgroundColor: palette.surfaceMuted },
      },
    },
    MuiLinearProgress: {
      styleOverrides: { root: { borderRadius: radii.pill, height: 8 } },
    },
    MuiAlert: {
      styleOverrides: { root: { borderRadius: radii.control, alignItems: 'center' } },
    },
  },
});

import { useState } from 'react';
import {
  Avatar,
  Box,
  Divider,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { USER_ROLE_LABEL } from '@south/shared';
import { useAuth } from '../../auth/AuthContext';
import { layout, palette, radii } from '../../theme/tokens';
import { initials } from '../../utils/format';
import { mobileNavItemsForRole, navItemsForRole } from './navigation';

/**
 * מעטפת האפליקציה: סרגל עליון כהה, סייד-בר ימני מתקפל וקנבס תוכן בהיר.
 * במובייל הסייד-בר מוחלף בניווט תחתון עם מטרות מגע גדולות (§17).
 */
export function AppShell() {
  const { user, logout } = useAuth();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [collapsed, setCollapsed] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;

  const items = navItemsForRole(user.role);
  const mobileItems = mobileNavItemsForRole(user.role);
  const sidebarWidth = collapsed ? layout.sidebarCollapsedWidth : layout.sidebarWidth;

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  return (
    <Box sx={{ minHeight: '100dvh', backgroundColor: palette.canvas }}>
      {/* ---------- סרגל עליון ---------- */}
      <Box
        component="header"
        sx={{
          height: layout.topBarHeight,
          backgroundColor: palette.navy900,
          color: palette.textInverse,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: { xs: 2, md: 3 },
          position: 'sticky',
          top: 0,
          zIndex: 1200,
        }}
      >
        <Stack direction="row" alignItems="center" gap={1.5}>
          {/*
            בסרגל העליון מוצג הסמל בלבד ולא הלוגו המלא: הלוגו הוא נעילה רחבה
            (יחס 2.4:1) שכוללת את שורת התיאור, ובגובה של 36 פיקסלים אותה שורה
            הופכת לטשטוש. הסמל חד בכל גודל, והשם והתיאור נשארים טקסט - קריא,
            ניתן לבחירה ונגיש לקורא מסך.
          */}
          <Box
            component="img"
            src="/icon-192.png"
            alt=""
            aria-hidden="true"
            sx={{ width: 36, height: 36, borderRadius: 2, flexShrink: 0 }}
          />
          <Box>
            <Typography sx={{ fontSize: 16, fontWeight: 800, lineHeight: 1.1 }}>
              דרומה
            </Typography>
            <Typography sx={{ fontSize: 11.5, opacity: 0.7 }}>
              דיגיטציה, ריכוז וניהול מעבר הציוד
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" alignItems="center" gap={1}>
          <Box sx={{ textAlign: 'start', display: { xs: 'none', sm: 'block' } }}>
            <Typography sx={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.2 }}>
              {user.fullName}
            </Typography>
            <Typography sx={{ fontSize: 11.5, opacity: 0.7 }}>
              {USER_ROLE_LABEL[user.role]}
              {user.baseName ? ` · ${user.baseName}` : ''}
            </Typography>
          </Box>
          <IconButton
            onClick={(event) => setMenuAnchor(event.currentTarget)}
            aria-label="תפריט משתמש"
            sx={{ p: 0.5 }}
          >
            <Avatar sx={{ width: 36, height: 36, backgroundColor: palette.primary, fontSize: 14 }}>
              {initials(user.fullName)}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          >
            <MenuItem disabled sx={{ opacity: '1 !important' }}>
              <Stack>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{user.fullName}</Typography>
                <Typography sx={{ fontSize: 12, color: palette.textSecondary }}>
                  {USER_ROLE_LABEL[user.role]}
                  {user.teamName ? ` · ${user.teamName}` : ''}
                </Typography>
              </Stack>
            </MenuItem>
            <Divider />
            <MenuItem
              onClick={async () => {
                setMenuAnchor(null);
                await logout();
                navigate('/login');
              }}
            >
              <LogoutRoundedIcon fontSize="small" style={{ marginInlineEnd: 8 }} />
              התנתקות
            </MenuItem>
          </Menu>
        </Stack>
      </Box>

      <Box sx={{ display: 'flex', minHeight: `calc(100dvh - ${layout.topBarHeight}px)` }}>
        {/* ---------- סייד-בר (דסקטופ) ---------- */}
        {isDesktop && (
          <Box
            component="nav"
            aria-label="ניווט ראשי"
            sx={{
              width: sidebarWidth,
              flexShrink: 0,
              backgroundColor: palette.navy800,
              color: palette.textInverse,
              transition: 'width .2s ease',
              position: 'sticky',
              top: layout.topBarHeight,
              height: `calc(100dvh - ${layout.topBarHeight}px)`,
              display: 'flex',
              flexDirection: 'column',
              py: 2,
            }}
          >
            <Stack gap={0.5} sx={{ px: 1.25, flex: 1 }}>
              {items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.to);
                return (
                  <Tooltip key={item.to} title={collapsed ? item.label : ''} placement="left">
                    <Box
                      component={NavLink}
                      to={item.to}
                      aria-current={active ? 'page' : undefined}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.25,
                        px: 1.5,
                        py: 1.25,
                        borderRadius: radii.control,
                        textDecoration: 'none',
                        color: active ? palette.textInverse : 'rgba(255,255,255,.72)',
                        backgroundColor: active ? palette.navy700 : 'transparent',
                        fontWeight: active ? 700 : 600,
                        fontSize: 14,
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        '&:hover': { backgroundColor: 'rgba(255,255,255,.08)' },
                      }}
                    >
                      <Icon fontSize="small" />
                      {!collapsed && <span>{item.label}</span>}
                    </Box>
                  </Tooltip>
                );
              })}
            </Stack>

            <Box sx={{ px: 1.25 }}>
              <IconButton
                onClick={() => setCollapsed((value) => !value)}
                aria-label={collapsed ? 'הרחבת תפריט' : 'כיווץ תפריט'}
                sx={{ color: 'rgba(255,255,255,.7)' }}
              >
                {collapsed ? <ChevronLeftRoundedIcon /> : <ChevronRightRoundedIcon />}
              </IconButton>
            </Box>
          </Box>
        )}

        {/* ---------- תוכן ---------- */}
        <Box
          component="main"
          sx={{
            flex: 1,
            minWidth: 0,
            px: { xs: `${layout.gutterMobile}px`, md: `${layout.gutterDesktop}px` },
            py: { xs: 2, md: 3 },
            pb: {
              xs: `calc(${layout.bottomNavHeight + 24}px + env(safe-area-inset-bottom))`,
              md: 3,
            },
            maxWidth: layout.maxContentWidth,
            mx: 'auto',
            width: '100%',
          }}
        >
          <Outlet />
        </Box>
      </Box>

      {/* ---------- ניווט תחתון (מובייל) ---------- */}
      {!isDesktop && (
        <Box
          component="nav"
          aria-label="ניווט ראשי"
          sx={{
            position: 'fixed',
            bottom: 0,
            insetInline: 0,
            height: `calc(${layout.bottomNavHeight}px + env(safe-area-inset-bottom))`,
            pb: 'env(safe-area-inset-bottom)',
            backgroundColor: palette.navy900,
            display: 'flex',
            alignItems: 'stretch',
            zIndex: 1200,
          }}
        >
          {mobileItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Box
                key={item.to}
                component={NavLink}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 0.25,
                  textDecoration: 'none',
                  color: active ? palette.textInverse : 'rgba(255,255,255,.65)',
                  fontSize: 11,
                  fontWeight: active ? 700 : 600,
                  borderTop: active ? `3px solid ${palette.primary}` : '3px solid transparent',
                }}
              >
                <Icon fontSize="small" />
                <span>{item.label}</span>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import QrCodeScannerRoundedIcon from '@mui/icons-material/QrCodeScannerRounded';
import AltRouteRoundedIcon from '@mui/icons-material/AltRouteRounded';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation, useNavigate } from 'react-router-dom';
import { DemoUserDto, LoginInput, USER_ROLE_LABEL, loginSchema } from '@south/shared';
import { useAuth } from '../../auth/AuthContext';
import { toUserError } from '../../api/errors';
import { palette, radii, tones } from '../../theme/tokens';

export function LoginPage() {
  const { login, demoUsers } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  const [demo, setDemo] = useState<{ users: DemoUserDto[]; demoPassword: string | null } | null>(
    null,
  );

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // מסך בחירת משתמש דמו זמין רק כאשר השרת מאפשר זאת (סביבת פיתוח/הדגמה).
  useEffect(() => {
    demoUsers()
      .then(setDemo)
      .catch(() => setDemo(null));
  }, [demoUsers]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await login(values);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== '/login' ? from : '/', { replace: true });
    } catch (error) {
      const details = toUserError(error, 'INVALID_CREDENTIALS');
      setServerError(details.hint ? `${details.message}. ${details.hint}` : details.message);
    }
  });

  const fillDemoUser = (user: DemoUserDto) => {
    setValue('email', user.email, { shouldValidate: true });
    if (demo?.demoPassword) {
      setValue('password', demo.demoPassword, { shouldValidate: true });
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        // במובייל הכותרת בגובה התוכן בלבד והטופס ממלא את השאר;
        // בדסקטופ שורה אחת שממלאת את כל הגובה (שני הפאנלים מלאים).
        gridTemplateRows: { xs: 'auto 1fr', md: '1fr' },
        backgroundColor: palette.canvas,
      }}
    >
      {/* כותרת מיתוג למובייל - בדסקטופ הפאנל הצדדי ממלא את התפקיד הזה */}
      <Box
        sx={{
          display: { xs: 'block', md: 'none' },
          position: 'relative',
          overflow: 'hidden',
          px: 3,
          pt: 5,
          pb: 7,
          background: `linear-gradient(160deg, ${palette.navy900} 0%, ${palette.navy700} 100%)`,
          color: palette.textInverse,
          borderEndStartRadius: 28,
          borderEndEndRadius: 28,
        }}
      >
        <Box
          aria-hidden="true"
          sx={{
            position: 'absolute',
            width: 260,
            height: 260,
            borderRadius: '50%',
            top: -130,
            insetInlineEnd: -90,
            background: `radial-gradient(circle, ${palette.primary}40 0%, transparent 70%)`,
          }}
        />
        <Stack direction="row" alignItems="center" gap={1.5} sx={{ position: 'relative' }}>
          <Box
            component="img"
            src="/icon-192.png"
            alt=""
            aria-hidden="true"
            sx={{ width: 46, height: 46, borderRadius: radii.control, flexShrink: 0 }}
          />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: 22, fontWeight: 800, lineHeight: 1.15 }}>
              דרומה
            </Typography>
            <Typography sx={{ fontSize: 12.5, opacity: 0.75 }}>
              דיגיטציה, ריכוז וניהול מעבר הציוד
            </Typography>
          </Box>
        </Stack>
        <Typography sx={{ fontSize: 14.5, opacity: 0.88, mt: 2.5, position: 'relative' }}>
          מקבלים משימה, אורזים, סוגרים עם QR — ובקליטה יודעים בדיוק לאיזה חדר הציוד הולך.
        </Typography>
      </Box>

      {/* פאנל מיתוג */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 3,
          px: 8,
          position: 'relative',
          overflow: 'hidden',
          background: `linear-gradient(160deg, ${palette.navy900} 0%, ${palette.navy700} 100%)`,
          color: palette.textInverse,
        }}
      >
        <Box
          aria-hidden="true"
          sx={{
            position: 'absolute',
            width: 520,
            height: 520,
            borderRadius: '50%',
            top: -220,
            insetInlineEnd: -180,
            background: `radial-gradient(circle, ${palette.primary}33 0%, transparent 70%)`,
          }}
        />
        <Box
          aria-hidden="true"
          sx={{
            position: 'absolute',
            width: 420,
            height: 420,
            borderRadius: '50%',
            bottom: -200,
            insetInlineStart: -160,
            background: `radial-gradient(circle, ${palette.violet}26 0%, transparent 70%)`,
          }}
        />

        <Stack direction="row" alignItems="center" gap={1.5} sx={{ position: 'relative' }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: radii.control,
              display: 'grid',
              placeItems: 'center',
              backgroundColor: 'rgba(255,255,255,.1)',
              border: '1px solid rgba(255,255,255,.16)',
            }}
          >
            <ShieldRoundedIcon sx={{ fontSize: 24 }} />
          </Box>
          <Typography sx={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5, opacity: 0.75 }}>
            מערכת לוגיסטיקה מבצעית
          </Typography>
        </Stack>

        {/*
          כאן יש מקום ללוגו המלא, ולכן מוצגת גרסת ה-Knockout (אותה יצירה, בלבן)
          ולא הגרסה הכהה: רקע הפאנל כהה, ולוגו כהה עליו אינו נראה.
          התמונה נושאת את שם המערכת, ולכן ה-alt הוא השם עצמו.
        */}
        <Box
          component="img"
          src="/logo-light.png"
          alt="דרומה"
          sx={{ width: '100%', maxWidth: 420, height: 'auto', position: 'relative', mt: 1 }}
        />
        <Typography sx={{ fontSize: 17, opacity: 0.85, maxWidth: 440, position: 'relative' }}>
          מקבלים משימה, אורזים, סוגרים אריזה עם QR — ובקריית התקשוב סורקים ויודעים בדיוק
          לאיזה חדר להביא. תמונת מצב מלאה למפקד, בזמן אמת.
        </Typography>

        <Stack gap={1.75} sx={{ mt: 2, position: 'relative' }}>
          {[
            { icon: AssignmentRoundedIcon, text: 'משימות אריזה מדויקות לפי חדר, צוות ופריט' },
            { icon: QrCodeScannerRoundedIcon, text: 'אריזה עם QR אקראי — בלי מידע רגיש על המדבקה' },
            { icon: AltRouteRoundedIcon, text: 'שליחות חכמה שמאחדת בסיסי איסוף ומסבירה את המסלול' },
            { icon: MapRoundedIcon, text: 'מפת חמש קומות אינטראקטיבית של בניין היעד' },
          ].map(({ icon: Icon, text }) => (
            <Stack key={text} direction="row" gap={1.5} alignItems="center">
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: radii.control,
                  display: 'grid',
                  placeItems: 'center',
                  backgroundColor: 'rgba(255,255,255,.08)',
                  flexShrink: 0,
                }}
              >
                <Icon sx={{ fontSize: 18, opacity: 0.9 }} />
              </Box>
              <Typography sx={{ fontSize: 15, opacity: 0.9 }}>{text}</Typography>
            </Stack>
          ))}
        </Stack>

        <Typography sx={{ fontSize: 12.5, opacity: 0.6, mt: 4, position: 'relative' }}>
          כל הנתונים במערכת הם נתוני דמה סינתטיים.
        </Typography>
      </Box>

      {/* טופס */}
      <Box
        sx={{
          display: 'grid',
          placeItems: 'center',
          alignContent: { xs: 'start', md: 'center' },
          px: { xs: 2, md: 6 },
          pt: { xs: 0, md: 6 },
          pb: { xs: 4, md: 6 },
          // הכרטיס עולה מעט על הכותרת המעוגלת במובייל, למראה אפליקטיבי.
          mt: { xs: -5, md: 0 },
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Card sx={{ p: { xs: 2.5, md: 4 }, width: '100%', maxWidth: 440 }}>
          <Typography sx={{ fontSize: { xs: 21, md: 24 }, fontWeight: 800 }}>
            התחברות למערכת
          </Typography>
          <Typography sx={{ fontSize: 14, color: palette.textSecondary, mt: 0.5 }}>
            הזינו את פרטי המשתמש שלכם כדי להמשיך
          </Typography>

          <Box component="form" onSubmit={onSubmit} noValidate sx={{ mt: 3 }}>
            <Stack gap={2}>
              <TextField
                label="אימייל"
                type="email"
                autoComplete="username"
                fullWidth
                size="medium"
                inputProps={{ dir: 'ltr' }}
                error={Boolean(errors.email)}
                helperText={errors.email?.message}
                {...register('email')}
              />
              <TextField
                label="סיסמה"
                type="password"
                autoComplete="current-password"
                fullWidth
                size="medium"
                inputProps={{ dir: 'ltr' }}
                error={Boolean(errors.password)}
                helperText={errors.password?.message}
                {...register('password')}
              />

              {serverError && <Alert severity="error">{serverError}</Alert>}

              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={isSubmitting}
                startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <LoginRoundedIcon />}
              >
                כניסה
              </Button>
            </Stack>
          </Box>

          {demo && demo.users.length > 0 && (
            <>
              <Divider sx={{ my: 3 }}>
                <Chip label="משתמשי דמו" size="small" />
              </Divider>
              <Typography sx={{ fontSize: 12.5, color: palette.textSecondary, mb: 1.5 }}>
                בחירת משתמש ממלאת את הטופס. ההתחברות עצמה עדיין מתבצעת עם סיסמה.
              </Typography>
              <Stack gap={1}>
                {demo.users.map((user) => (
                  <Box
                    key={user.email}
                    component="button"
                    type="button"
                    onClick={() => fillDemoUser(user)}
                    sx={{
                      textAlign: 'start',
                      border: `1px solid ${palette.border}`,
                      borderRadius: radii.control,
                      background: palette.surface,
                      p: 1.25,
                      cursor: 'pointer',
                      '&:hover': { borderColor: tones.primary.main, background: tones.primary.soft },
                    }}
                  >
                    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>
                          {user.fullName}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: palette.textSecondary }} noWrap>
                          {user.description}
                        </Typography>
                      </Box>
                      <Chip label={USER_ROLE_LABEL[user.role]} size="small" />
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </>
          )}
        </Card>

        {/* במובייל אין את הפאנל הצדדי, ולכן ההבהרה מופיעה כאן */}
        <Typography
          sx={{
            display: { xs: 'block', md: 'none' },
            fontSize: 12,
            color: palette.textSecondary,
            textAlign: 'center',
            mt: 2.5,
            px: 2,
          }}
        >
          כל הנתונים במערכת הם נתוני דמה סינתטיים.
        </Typography>
      </Box>
    </Box>
  );
}

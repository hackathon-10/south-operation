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
        backgroundColor: palette.canvas,
      }}
    >
      {/* פאנל מיתוג */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 3,
          px: 8,
          background: `linear-gradient(160deg, ${palette.navy900} 0%, ${palette.navy700} 100%)`,
          color: palette.textInverse,
        }}
      >
        <Typography sx={{ fontSize: 40, fontWeight: 800, lineHeight: 1.15 }}>
          המעבר דרומה
        </Typography>
        <Typography sx={{ fontSize: 17, opacity: 0.85, maxWidth: 440 }}>
          מקבלים משימה, אורזים, סוגרים אריזה עם QR — ובקריית התקשוב סורקים ויודעים בדיוק
          לאיזה חדר להביא. תמונת מצב מלאה למפקד, בזמן אמת.
        </Typography>

        <Stack gap={1.5} sx={{ mt: 2 }}>
          {[
            'משימות אריזה מדויקות לפי חדר, צוות ופריט',
            'אריזה עם QR אקראי — בלי מידע רגיש על המדבקה',
            'שליחות חכמה שמאחדת בסיסי איסוף ומסבירה את המסלול',
            'מפת חמש קומות אינטראקטיבית של בניין היעד',
          ].map((line) => (
            <Stack key={line} direction="row" gap={1.25} alignItems="center">
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: palette.primary,
                  flexShrink: 0,
                }}
              />
              <Typography sx={{ fontSize: 15, opacity: 0.9 }}>{line}</Typography>
            </Stack>
          ))}
        </Stack>

        <Typography sx={{ fontSize: 12.5, opacity: 0.6, mt: 4 }}>
          כל הנתונים במערכת הם נתוני דמה סינתטיים.
        </Typography>
      </Box>

      {/* טופס */}
      <Box sx={{ display: 'grid', placeItems: 'center', px: { xs: 2, md: 6 }, py: 6 }}>
        <Card sx={{ p: { xs: 3, md: 4 }, width: '100%', maxWidth: 440 }}>
          <Typography sx={{ fontSize: 24, fontWeight: 800 }}>התחברות למערכת</Typography>
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
      </Box>
    </Box>
  );
}

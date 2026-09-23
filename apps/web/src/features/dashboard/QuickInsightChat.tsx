import { useState } from 'react';
import {
  Box,
  Card,
  Chip,
  Collapse,
  Divider,
  IconButton,
  InputBase,
  Stack,
  Typography,
} from '@mui/material';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { palette, tones } from '../../theme/tokens';

export type QuickInsightPrompt = {
  label: string;
  answer: string;
};

export function QuickInsightChat({
  title = 'העוזר המהיר',
  prompts,
}: {
  title?: string;
  prompts: QuickInsightPrompt[];
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [lastAnswer, setLastAnswer] = useState<string | null>(null);

  const submit = (raw: string) => {
    const query = raw.trim();
    if (!query) return;

    const found = prompts.find(
      (prompt) =>
        prompt.label.toLowerCase().includes(query.toLowerCase()) ||
        query.toLowerCase().includes(prompt.label.toLowerCase()),
    );

    setLastAnswer(found?.answer ?? `לצערי אני יכול לענות רק על נתונים בסיסיים כמו: ${prompts[0]?.label ?? 'סטטוסים כלליים'}`);
  };

  return (
    <Box
      sx={{
        ...(open
          ? {
              position: 'relative',
              mb: 3,
            }
          : {
              position: 'fixed',
              right: 12,
              top: '50%',
              zIndex: 1200,
              transform: 'translateY(-50%)',
            }),
      }}
    >
      {open ? (
        <Card
          sx={{
            p: 1.25,
            border: `1px solid ${tones.primary.soft}`,
            background: `linear-gradient(135deg, ${tones.primary.soft} 0%, ${palette.surface} 100%)`,
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
            <Stack direction="row" alignItems="center" gap={1}>
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'grid',
                  placeItems: 'center',
                  backgroundColor: tones.primary.soft,
                  color: tones.primary.main,
                }}
              >
                <SmartToyRoundedIcon fontSize="small" />
              </Box>
              <Typography sx={{ fontSize: 13.5, fontWeight: 800 }}>{title}</Typography>
            </Stack>

            <IconButton
              size="small"
              onClick={() => setOpen(false)}
              aria-label="סגירת העוזר"
              sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                bgcolor: palette.surface,
                border: `1px solid ${palette.border}`,
              }}
            >
              <ExpandMoreRoundedIcon fontSize="small" sx={{ transform: 'rotate(180deg)' }} />
            </IconButton>
          </Stack>

          <Collapse in={open} timeout="auto" unmountOnExit>
            <Stack sx={{ pt: 1.5 }}>
          <Stack direction="row" gap={1} sx={{ flexWrap: 'wrap', mb: 1.25 }}>
            {prompts.slice(0, 4).map((prompt) => (
              <Chip
                key={prompt.label}
                label={prompt.label}
                size="small"
                clickable
                onClick={() => {
                  setValue(prompt.label);
                  setLastAnswer(prompt.answer);
                }}
                sx={{
                  bgcolor: palette.surface,
                  border: `1px solid ${palette.border}`,
                  color: palette.textPrimary,
                  fontSize: 11.5,
                }}
              />
            ))}
          </Stack>

          <Divider sx={{ mb: 1.25 }} />

          <Stack direction="row" alignItems="center" gap={1}>
            <InputBase
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  submit(value);
                }
              }}
              placeholder="שאל על נתונים בסיסיים..."
              sx={{
                flex: 1,
                px: 1.25,
                py: 0.7,
                borderRadius: 2,
                bgcolor: palette.surface,
                border: `1px solid ${palette.border}`,
                fontSize: 13,
                minHeight: 34,
              }}
            />
            <IconButton
              size="small"
              onClick={() => submit(value)}
              sx={{
                bgcolor: tones.primary.main,
                color: '#fff',
                width: 32,
                height: 32,
                '&:hover': { bgcolor: palette.primaryDark },
              }}
              aria-label="שלח שאלה"
            >
              <SendRoundedIcon fontSize="small" />
            </IconButton>
          </Stack>

          {lastAnswer && (
            <Typography
              sx={{
                fontSize: 15,
                lineHeight: 1.6,
                color: palette.textPrimary,
                mt: 1.25,
                fontWeight: 600,
              }}
            >
              {lastAnswer}
            </Typography>
          )}
              <Typography sx={{ fontSize: 10.5, color: palette.textSecondary, mt: 1 }}>
                note: ML capabilities in progress
              </Typography>
            </Stack>
          </Collapse>
        </Card>
      ) : (
        <IconButton
          onClick={() => setOpen(true)}
          aria-label="פתיחת העוזר"
          title={title}
          sx={{
            width: 38,
            height: 38,
            bgcolor: tones.primary.soft,
            color: tones.primary.main,
            border: `1px solid ${tones.primary.soft}`,
            boxShadow: '0 3px 10px rgba(15, 30, 50, 0.12)',
            animation: 'quietPulse 3s ease-in-out infinite',
            '&:hover': {
              bgcolor: palette.surface,
              color: tones.primary.main,
            },
            '@keyframes quietPulse': {
              '0%, 100%': { opacity: 0.78, transform: 'scale(1)' },
              '50%': { opacity: 1, transform: 'scale(1.06)' },
            },
          }}
        >
          <SmartToyRoundedIcon sx={{ fontSize: 19 }} />
        </IconButton>
      )}
    </Box>
  );
}

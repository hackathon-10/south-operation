import { useMemo, useState } from 'react';
import {
  Box,
  Card,
  Chip,
  Divider,
  IconButton,
  InputBase,
  Stack,
  Typography,
} from '@mui/material';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
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
  const [value, setValue] = useState('');
  const [lastAnswer, setLastAnswer] = useState<string | null>(null);

  const promptMap = useMemo(
    () =>
      new Map(
        prompts.map((prompt) => [prompt.label.toLowerCase().trim(), prompt.answer]),
      ),
    [prompts],
  );

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
    <Card
      sx={{
        p: 2,
        mb: 3,
        border: `1px solid ${tones.primary.soft}`,
        background: `linear-gradient(135deg, ${tones.primary.soft} 0%, ${palette.surface} 100%)`,
      }}
    >
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            backgroundColor: tones.primary.soft,
            color: tones.primary.main,
          }}
        >
          <SmartToyRoundedIcon fontSize="small" />
        </Box>
        <Typography sx={{ fontSize: 14, fontWeight: 800 }}>{title}</Typography>
      </Stack>

      <Stack direction="row" gap={1} sx={{ flexWrap: 'wrap', mb: 1.5 }}>
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
            }}
          />
        ))}
      </Stack>

      <Divider sx={{ mb: 1.5 }} />

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
            py: 0.75,
            borderRadius: 2,
            bgcolor: palette.surface,
            border: `1px solid ${palette.border}`,
            fontSize: 13,
          }}
        />
        <IconButton
          size="small"
          onClick={() => submit(value)}
          sx={{
            bgcolor: tones.primary.main,
            color: '#fff',
            '&:hover': { bgcolor: palette.primaryDark },
          }}
          aria-label="שלח שאלה"
        >
          <SendRoundedIcon fontSize="small" />
        </IconButton>
      </Stack>

      {lastAnswer && (
        <Typography sx={{ fontSize: 12.5, color: palette.textSecondary, mt: 1.5 }}>
          {lastAnswer}
        </Typography>
      )}
    </Card>
  );
}

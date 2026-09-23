import {
  Box,
  Button,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import ViewListRoundedIcon from '@mui/icons-material/ViewListRounded';
import { palette, radii } from '../../theme/tokens';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDefinition {
  id: string;
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}

interface FilterBarProps {
  search?: {
    value: string;
    placeholder: string;
    onChange: (value: string) => void;
  };
  filters?: FilterDefinition[];
  onReset?: () => void;
  view?: {
    value: 'grid' | 'list';
    onChange: (value: 'grid' | 'list') => void;
  };
}

/** סרגל סינון בצורת גלולות, עם חיפוש רחב, איפוס ומתג תצוגה. */
export function FilterBar({ search, filters = [], onReset, view }: FilterBarProps) {
  return (
    <Stack gap={1.5} sx={{ mb: 2.5 }}>
      {search && (
        <TextField
          value={search.value}
          onChange={(event) => search.onChange(event.target.value)}
          placeholder={search.placeholder}
          fullWidth
          size="medium"
          inputProps={{ 'aria-label': search.placeholder }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ color: palette.textSecondary }} />
              </InputAdornment>
            ),
            sx: { borderRadius: radii.pill, backgroundColor: palette.surface },
          }}
        />
      )}

      <Stack
        direction="row"
        gap={1}
        sx={{ flexWrap: 'wrap', alignItems: 'center' }}
      >
        {filters.map((filter) => (
          <TextField
            key={filter.id}
            select
            size="small"
            label={filter.label}
            value={filter.value}
            onChange={(event) => filter.onChange(event.target.value)}
            sx={{
              // במובייל שני סינונים בשורה במקום גלישה לא אחידה; מ-sm ומעלה
              // הרוחב נקבע לפי התוכן כמו קודם.
              flex: { xs: '1 1 calc(50% - 4px)', sm: '0 0 auto' },
              minWidth: { xs: 0, sm: 160 },
              '& .MuiOutlinedInput-root': { borderRadius: radii.pill },
            }}
          >
            {filter.options.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        ))}

        {onReset && (
          <Button
            onClick={onReset}
            startIcon={<RestartAltRoundedIcon />}
            sx={{
              flex: { xs: '1 1 100%', sm: '0 0 auto' },
              borderRadius: radii.pill,
              backgroundColor: palette.surface,
              border: `1px solid ${palette.border}`,
              color: palette.textSecondary,
            }}
          >
            נקה הכל
          </Button>
        )}

        <Box sx={{ flexGrow: 1 }} />

        {view && (
          <ToggleButtonGroup
            value={view.value}
            exclusive
            size="small"
            onChange={(_, next) => next && view.onChange(next)}
            sx={{ backgroundColor: palette.surface, borderRadius: radii.control }}
            aria-label="תצוגה"
          >
            <ToggleButton value="grid" aria-label="תצוגת כרטיסים">
              <GridViewRoundedIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="list" aria-label="תצוגת רשימה">
              <ViewListRoundedIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
        )}
      </Stack>
    </Stack>
  );
}

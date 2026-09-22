import { Pagination, Stack, Typography } from '@mui/material';
import { palette } from '../../theme/tokens';

interface PaginatorProps {
  page: number;
  totalPages: number;
  total: number;
  itemNoun: string;
  onChange: (page: number) => void;
}

/** ניווט עמודים עגול + מונה סה״כ, לפי שפת העיצוב. */
export function Paginator({ page, totalPages, total, itemNoun, onChange }: PaginatorProps) {
  if (total === 0) return null;

  return (
    <Stack
      direction={{ xs: 'column-reverse', sm: 'row' }}
      alignItems="center"
      justifyContent="space-between"
      gap={1.5}
      sx={{ mt: 3 }}
    >
      <Typography sx={{ fontSize: 13, color: palette.textSecondary }}>
        סה״כ {total.toLocaleString('he-IL')} {itemNoun}
      </Typography>

      {totalPages > 1 && (
        <Pagination
          page={page}
          count={totalPages}
          onChange={(_, value) => onChange(value)}
          shape="circular"
          color="primary"
          siblingCount={0}
          boundaryCount={1}
          aria-label="ניווט בין עמודים"
        />
      )}
    </Stack>
  );
}

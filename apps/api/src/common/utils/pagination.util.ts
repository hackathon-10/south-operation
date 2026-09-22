import type { PaginatedResult } from '@south/shared';

export interface PaginationInput {
  page: number;
  pageSize: number;
}

export function toSkipTake({ page, pageSize }: PaginationInput): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function paginate<T>(
  items: T[],
  total: number,
  { page, pageSize }: PaginationInput,
): PaginatedResult<T> {
  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

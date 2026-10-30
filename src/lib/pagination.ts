export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const paginate = <T>(items: T[], page: number, limit: number): PaginatedResult<T> => {
  const total = items.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const data = items.slice(start, start + limit);
  return { data, total, page, limit, totalPages };
};

export const getPaginationRange = (current: number, total: number, delta = 2): (number | -1)[] => {
  const range: (number | -1)[] = [];
  const left = current - delta;
  const right = current + delta + 1;
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= left && i < right)) {
      range.push(i);
    } else if (range[range.length - 1] !== -1) {
      range.push(-1);
    }
  }
  return range;
};

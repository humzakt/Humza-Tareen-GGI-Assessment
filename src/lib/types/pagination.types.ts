export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

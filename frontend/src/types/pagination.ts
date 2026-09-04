export type PaginatedList<T> = {
  items: T[]
  page: number
  pageSize: number
  total: number
  hasNext: boolean
}

export type ListPaginationParams = {
  page?: number
  pageSize?: number
}

export const DEFAULT_PAGE_SIZE = 20
export const PICKER_PAGE_SIZE = 100

export type PaginatedApi<T> = {
  items: T[]
  page: number
  page_size: number
  total: number
  has_next: boolean
}

export function mapPaginated<T>(data: PaginatedApi<T>): PaginatedList<T> {
  return {
    items: data.items,
    page: data.page,
    pageSize: data.page_size,
    total: data.total,
    hasNext: data.has_next,
  }
}

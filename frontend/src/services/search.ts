import { api } from "@/services/api"
import type { GlobalSearchResponse } from "@/types/search"

export type GlobalSearchParams = {
  query: string
  limit?: number
}

export async function globalSearch(
  params: GlobalSearchParams,
): Promise<GlobalSearchResponse> {
  const trimmed = params.query.trim()
  const { data } = await api.get<GlobalSearchResponse>("/search", {
    params: {
      q: trimmed,
      limit: params.limit,
    },
  })
  return data
}

export function countGlobalSearchHits(result: GlobalSearchResponse): number {
  return (
    result.conversations.length +
    result.tickets.length +
    result.customers.length +
    result.knowledge.length
  )
}

import type { QueryClient } from "@tanstack/react-query"

export const WORKSPACE_SCOPED_QUERY_KEYS = [
  ["customers"],
  ["tickets"],
  ["team"],
  ["conversations"],
] as const

export async function resetWorkspaceScopedQueries(
  queryClient: QueryClient,
): Promise<void> {
  await Promise.all(
    WORKSPACE_SCOPED_QUERY_KEYS.map((queryKey) =>
      queryClient.resetQueries({ queryKey: [...queryKey] }),
    ),
  )
}

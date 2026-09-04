import { describe, expect, it, vi } from "vitest"
import type { QueryClient } from "@tanstack/react-query"

import {
  resetWorkspaceScopedQueries,
  WORKSPACE_SCOPED_QUERY_KEYS,
} from "@/lib/workspace-queries"

describe("workspace-scoped query reset", () => {
  it("resets customers, tickets, team, and conversations queries", async () => {
    const resetQueries = vi.fn().mockResolvedValue(undefined)
    const queryClient = { resetQueries } as unknown as QueryClient

    await resetWorkspaceScopedQueries(queryClient)

    expect(resetQueries).toHaveBeenCalledTimes(WORKSPACE_SCOPED_QUERY_KEYS.length)
    expect(resetQueries).toHaveBeenCalledWith({ queryKey: ["customers"] })
    expect(resetQueries).toHaveBeenCalledWith({ queryKey: ["tickets"] })
    expect(resetQueries).toHaveBeenCalledWith({ queryKey: ["team"] })
    expect(resetQueries).toHaveBeenCalledWith({ queryKey: ["conversations"] })
  })
})

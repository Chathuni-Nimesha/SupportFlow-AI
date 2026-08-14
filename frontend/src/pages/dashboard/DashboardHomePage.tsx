import { useCallback, useEffect, useState } from "react"

import {
  ActivityTimeline,
  AiPerformanceOverview,
  AiSummaryCard,
  KpiCards,
  QuickActions,
  RecentConversationsTable,
  RecentTicketsTable,
  WelcomeHeader,
} from "@/components/dashboard/home"
import { listConversations } from "@/services/conversations"
import type { ConversationApi } from "@/types/conversations"
import { getApiErrorMessage } from "@/utils/api-error"

export function DashboardHomePage() {
  const [conversations, setConversations] = useState<ConversationApi[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadConversations = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await listConversations()
      setConversations(data)
    } catch (loadError) {
      setConversations([])
      setError(
        getApiErrorMessage(loadError, "Unable to load conversations."),
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  return (
    <div className="space-y-6">
      <WelcomeHeader />
      <KpiCards
        conversationCount={conversations.length}
        isLoading={isLoading}
        error={error}
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <AiPerformanceOverview />
        <AiSummaryCard />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <RecentConversationsTable
          conversations={conversations.slice(0, 5)}
          isLoading={isLoading}
          error={error}
          onRetry={() => void loadConversations()}
        />
        <RecentTicketsTable />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <ActivityTimeline />
        <QuickActions />
      </div>
    </div>
  )
}

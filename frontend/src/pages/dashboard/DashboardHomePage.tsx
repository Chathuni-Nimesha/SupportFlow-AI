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
import { listTickets } from "@/services/tickets"
import type { ConversationApi } from "@/types/conversations"
import type { Ticket } from "@/types/tickets"
import { getApiErrorMessage } from "@/utils/api-error"

export function DashboardHomePage() {
  const [conversations, setConversations] = useState<ConversationApi[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(true)
  const [ticketsError, setTicketsError] = useState<string | null>(null)

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

  const loadTickets = useCallback(async () => {
    setTicketsLoading(true)
    setTicketsError(null)
    try {
      const data = await listTickets()
      setTickets(data)
    } catch (loadError) {
      setTickets([])
      setTicketsError(getApiErrorMessage(loadError, "Unable to load tickets."))
    } finally {
      setTicketsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadConversations()
    void loadTickets()
  }, [loadConversations, loadTickets])

  const openTicketCount = tickets.filter(
    (ticket) => ticket.status === "OPEN",
  ).length

  return (
    <div className="space-y-6">
      <WelcomeHeader />
      <KpiCards
        conversationCount={conversations.length}
        isLoading={isLoading}
        error={error}
        openTicketCount={openTicketCount}
        ticketsLoading={ticketsLoading}
        ticketsError={ticketsError}
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
        <RecentTicketsTable
          tickets={tickets.slice(0, 5)}
          isLoading={ticketsLoading}
          error={ticketsError}
          onRetry={() => void loadTickets()}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <ActivityTimeline />
        <QuickActions />
      </div>
    </div>
  )
}

import { useQuery } from "@tanstack/react-query"

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
import { getApiErrorMessage } from "@/utils/api-error"

export function DashboardHomePage() {
  const conversationsQuery = useQuery({
    queryKey: ["conversations", "home"],
    queryFn: () => listConversations({ page: 1, pageSize: 5 }),
  })
  const recentTicketsQuery = useQuery({
    queryKey: ["tickets", "home-recent"],
    queryFn: () => listTickets({ page: 1, pageSize: 5 }),
  })
  const openTicketsQuery = useQuery({
    queryKey: ["tickets", "open-count"],
    queryFn: () => listTickets({ status: "OPEN", page: 1, pageSize: 1 }),
  })

  const conversations = conversationsQuery.data?.items ?? []
  const conversationError = conversationsQuery.isError
    ? getApiErrorMessage(
        conversationsQuery.error,
        "Unable to load conversations.",
      )
    : null
  const tickets = recentTicketsQuery.data?.items ?? []
  const ticketsError = recentTicketsQuery.isError
    ? getApiErrorMessage(recentTicketsQuery.error, "Unable to load tickets.")
    : null
  const openTicketError = openTicketsQuery.isError
    ? getApiErrorMessage(openTicketsQuery.error, "Unable to load tickets.")
    : null

  return (
    <div className="space-y-6">
      <WelcomeHeader />
      <KpiCards
        conversationCount={conversationsQuery.data?.total ?? 0}
        isLoading={conversationsQuery.isLoading}
        error={conversationError}
        openTicketCount={openTicketsQuery.data?.total ?? 0}
        ticketsLoading={openTicketsQuery.isLoading}
        ticketsError={openTicketError}
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <AiPerformanceOverview />
        <AiSummaryCard />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <RecentConversationsTable
          conversations={conversations}
          isLoading={conversationsQuery.isLoading}
          error={conversationError}
          onRetry={() => void conversationsQuery.refetch()}
        />
        <RecentTicketsTable
          tickets={tickets}
          isLoading={recentTicketsQuery.isLoading}
          error={ticketsError}
          onRetry={() => void recentTicketsQuery.refetch()}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <ActivityTimeline />
        <QuickActions />
      </div>
    </div>
  )
}

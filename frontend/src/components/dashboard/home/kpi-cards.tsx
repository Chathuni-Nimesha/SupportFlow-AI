import {
  BarChart3,
  MessageSquare,
  Sparkles,
  Ticket,
} from "lucide-react"

import { KpiCard } from "@/components/dashboard/home/kpi-card"
import type { KpiMetric } from "@/data/dashboard-home"

const icons = {
  conversations: MessageSquare,
  tickets: Ticket,
  "ai-rate": Sparkles,
  csat: BarChart3,
} as const

type KpiCardsProps = {
  conversationCount: number
  isLoading?: boolean
  error?: string | null
  openTicketCount: number
  ticketsLoading?: boolean
  ticketsError?: string | null
}

export function KpiCards({
  conversationCount,
  isLoading = false,
  error = null,
  openTicketCount,
  ticketsLoading = false,
  ticketsError = null,
}: KpiCardsProps) {
  const conversationValue = isLoading
    ? "…"
    : error
      ? "—"
      : conversationCount.toLocaleString()

  const ticketValue = ticketsLoading
    ? "…"
    : ticketsError
      ? "—"
      : openTicketCount.toLocaleString()

  const metrics: KpiMetric[] = [
    {
      id: "conversations",
      label: "Total Conversations",
      value: conversationValue,
      change: error ? "Error" : isLoading ? "Loading" : "Live",
      trend: "neutral",
      helper: error
        ? error
        : isLoading
          ? "Loading from your workspace"
          : "from your workspace",
    },
    {
      id: "tickets",
      label: "Open Tickets",
      value: ticketValue,
      change: ticketsError ? "Error" : ticketsLoading ? "Loading" : "Live",
      trend: "neutral",
      helper: ticketsError
        ? ticketsError
        : ticketsLoading
          ? "Loading from your workspace"
          : "OPEN tickets in your workspace",
    },
    {
      id: "ai-rate",
      label: "AI Resolution Rate",
      value: "Not available",
      change: "—",
      trend: "neutral",
      helper: "No resolution-rate metric yet",
    },
    {
      id: "csat",
      label: "CSAT",
      value: "Not available",
      change: "—",
      trend: "neutral",
      helper: "No CSAT backend yet",
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric, index) => (
        <KpiCard
          key={metric.id}
          metric={metric}
          icon={icons[metric.id as keyof typeof icons]}
          index={index}
        />
      ))}
    </div>
  )
}

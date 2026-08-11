import {
  BarChart3,
  MessageSquare,
  Sparkles,
  Ticket,
} from "lucide-react"

import { KpiCard } from "@/components/dashboard/home/kpi-card"
import { dashboardKpis } from "@/data/dashboard-home"

const icons = {
  conversations: MessageSquare,
  tickets: Ticket,
  "ai-rate": Sparkles,
  csat: BarChart3,
} as const

export function KpiCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {dashboardKpis.map((metric, index) => (
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

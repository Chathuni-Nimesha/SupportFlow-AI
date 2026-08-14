import {
  CheckCircle2,
  CircleDot,
  Clock3,
  MessageSquare,
  Sparkles,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { motion } from "framer-motion"

import type { ConversationStatusCounts } from "@/components/analytics/conversation-counts"
import { Card, CardContent } from "@/components/ui/card"

const metrics: {
  id: keyof ConversationStatusCounts
  label: string
  icon: LucideIcon
}[] = [
  { id: "total", label: "Total Conversations", icon: MessageSquare },
  { id: "Open", label: "Open Conversations", icon: CircleDot },
  { id: "Waiting", label: "Waiting Conversations", icon: Clock3 },
  { id: "Closed", label: "Closed Conversations", icon: CheckCircle2 },
  { id: "AI Resolved", label: "AI Resolved Conversations", icon: Sparkles },
]

type ConversationKpiCardsProps = {
  counts: ConversationStatusCounts
}

export function ConversationKpiCards({ counts }: ConversationKpiCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {metrics.map((metric, index) => {
        const Icon = metric.icon
        return (
          <motion.div
            key={metric.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: index * 0.05 }}
          >
            <Card className="rounded-2xl border-border/70 bg-card shadow-soft ring-border/60">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {metric.label}
                    </p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                      {counts[metric.id].toLocaleString()}
                    </p>
                  </div>
                  <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="size-4" aria-hidden />
                  </span>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Conversation metric
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
}

import { motion } from "framer-motion"
import {
  AlertTriangle,
  CircleDot,
  Clock3,
  CheckCircle2,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"

const kpis: {
  id: string
  label: string
  icon: LucideIcon
}[] = [
  { id: "open", label: "Open Tickets", icon: CircleDot },
  { id: "pending", label: "Pending", icon: Clock3 },
  { id: "resolved", label: "Resolved Today", icon: CheckCircle2 },
  { id: "high", label: "High Priority", icon: AlertTriangle },
]

export function TicketKpiCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi, index) => {
        const Icon = kpi.icon
        return (
          <motion.div
            key={kpi.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: index * 0.05 }}
          >
            <Card className="rounded-2xl border-border/70 bg-card shadow-soft ring-border/60">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {kpi.label}
                    </p>
                    <p className="mt-2 text-lg font-semibold tracking-tight text-muted-foreground">
                      Not available
                    </p>
                  </div>
                  <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="size-4" aria-hidden />
                  </span>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  No tickets backend yet
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
}

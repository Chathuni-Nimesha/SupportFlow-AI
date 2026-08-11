import { motion } from "framer-motion"
import {
  AlertTriangle,
  CircleDot,
  Clock3,
  CheckCircle2,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { ticketKpis } from "@/data/tickets"
import { Card, CardContent } from "@/components/ui/card"

const icons: Record<string, LucideIcon> = {
  open: CircleDot,
  pending: Clock3,
  resolved: CheckCircle2,
  high: AlertTriangle,
}

export function TicketKpiCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {ticketKpis.map((kpi, index) => {
        const Icon = icons[kpi.id]
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
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                      {kpi.value}
                    </p>
                  </div>
                  <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="size-4" aria-hidden />
                  </span>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {kpi.change}
                  </span>{" "}
                  {kpi.helper}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
}

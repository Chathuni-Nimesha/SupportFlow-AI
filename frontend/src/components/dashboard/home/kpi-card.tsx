import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { motion } from "framer-motion"

import type { KpiMetric, TrendDirection } from "@/data/dashboard-home"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const trendIcon: Record<TrendDirection, LucideIcon> = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  neutral: Minus,
}

type KpiCardProps = {
  metric: KpiMetric
  icon: LucideIcon
  index?: number
}

export function KpiCard({ metric, icon: Icon, index = 0 }: KpiCardProps) {
  const TrendIcon = trendIcon[metric.trend]
  const positive = metric.trend === "up"
  const negative = metric.trend === "down"

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="rounded-2xl border-border/70 bg-card shadow-soft ring-border/60 transition-shadow hover:shadow-soft-lg">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {metric.label}
              </p>
              <p
                className={
                  metric.value === "Not available"
                    ? "mt-2 text-lg font-semibold tracking-tight text-muted-foreground"
                    : "mt-2 text-3xl font-semibold tracking-tight text-foreground"
                }
              >
                {metric.value}
              </p>
            </div>
            <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icon className="size-4" aria-hidden />
            </span>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs">
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-2 py-1 font-medium",
                positive && "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
                negative && "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
                metric.trend === "neutral" && "bg-muted text-muted-foreground",
              )}
            >
              <TrendIcon className="size-3.5" aria-hidden />
              {metric.change}
            </span>
            <span className="text-muted-foreground">{metric.helper}</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

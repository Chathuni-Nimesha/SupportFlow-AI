import { motion } from "framer-motion"
import { Bot, Clock3, ShieldAlert } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const stats = [
  {
    label: "AI handled today",
    icon: Bot,
  },
  {
    label: "Escalated",
    icon: ShieldAlert,
  },
  {
    label: "Avg. response time",
    icon: Clock3,
  },
]

export function AiSummaryCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="h-full rounded-2xl border-border/70 bg-card shadow-soft ring-border/60">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-lg">AI Summary</CardTitle>
          <CardDescription className="mt-1">
            Snapshot of autonomous support activity for today.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="grid gap-3">
            {stats.map((stat) => {
              const Icon = stat.icon
              return (
                <div
                  key={stat.label}
                  className="flex items-center justify-between rounded-2xl border border-border/70 bg-background px-3.5 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Not available
                  </p>
                </div>
              )
            })}
          </div>

          <div className="rounded-2xl bg-primary/5 p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">
                Automation coverage
              </span>
              <span className="font-medium text-muted-foreground">
                Not available
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              No automation-coverage metric is available from the backend yet.
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

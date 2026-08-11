import { motion } from "framer-motion"
import { Bot, Settings2, Ticket, UsersRound } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { activityTimeline, type ActivityItem } from "@/data/dashboard-home"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

const typeMeta: Record<
  ActivityItem["type"],
  { icon: LucideIcon; className: string }
> = {
  ai: {
    icon: Bot,
    className: "bg-primary/10 text-primary",
  },
  ticket: {
    icon: Ticket,
    className: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  },
  team: {
    icon: UsersRound,
    className: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  },
  system: {
    icon: Settings2,
    className: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
  },
}

export function ActivityTimeline() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="h-full rounded-2xl border-border/70 bg-card shadow-soft ring-border/60">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-lg">Activity Timeline</CardTitle>
          <CardDescription className="mt-1">
            Live operational events across AI, tickets, and team.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <ol className="space-y-4">
            {activityTimeline.map((item, index) => {
              const meta = typeMeta[item.type]
              const Icon = meta.icon
              return (
                <li key={item.id} className="relative flex gap-3">
                  {index < activityTimeline.length - 1 ? (
                    <span
                      className="absolute top-10 bottom-[-1rem] left-[1.15rem] w-px bg-border"
                      aria-hidden
                    />
                  ) : null}
                  <span
                    className={cn(
                      "relative z-10 flex size-9 shrink-0 items-center justify-center rounded-xl",
                      meta.className,
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1 rounded-2xl border border-border/70 bg-background px-3.5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">
                        {item.title}
                      </p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {item.time}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        </CardContent>
      </Card>
    </motion.div>
  )
}

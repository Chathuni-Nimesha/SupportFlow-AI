import { motion } from "framer-motion"
import { Link } from "react-router-dom"
import {
  BookOpen,
  Bot,
  MessageSquarePlus,
  TicketPlus,
  UserPlus,
  BarChart3,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type QuickAction = {
  label: string
  description: string
  href: string
  icon: LucideIcon
}

const actions: QuickAction[] = [
  {
    label: "Start conversation",
    description: "Open a new customer thread",
    href: "/dashboard/conversations",
    icon: MessageSquarePlus,
  },
  {
    label: "Create ticket",
    description: "Log a tracked support issue",
    href: "/dashboard/tickets",
    icon: TicketPlus,
  },
  {
    label: "Add knowledge",
    description: "Upload docs for the AI agent",
    href: "/dashboard/knowledge-base",
    icon: BookOpen,
  },
  {
    label: "Invite teammate",
    description: "Grow your support pod",
    href: "/dashboard/team",
    icon: UserPlus,
  },
  {
    label: "Tune AI assistant",
    description: "Adjust tone and guardrails",
    href: "/dashboard/ai-assistant",
    icon: Bot,
  },
  {
    label: "View analytics",
    description: "Inspect deeper trends",
    href: "/dashboard/analytics",
    icon: BarChart3,
  },
]

export function QuickActions() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.36, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="rounded-2xl border-border/70 bg-card shadow-soft ring-border/60">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-lg">Quick Actions</CardTitle>
          <CardDescription className="mt-1">
            Jump into the workflows your team uses most.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {actions.map((action) => {
              const Icon = action.icon
              return (
                <Link
                  key={action.label}
                  to={action.href}
                  className="group flex items-start gap-3 rounded-2xl border border-border/70 bg-background p-4 transition hover:border-primary/30 hover:bg-primary/[0.03] hover:shadow-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary transition group-hover:scale-105">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-foreground">
                      {action.label}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {action.description}
                    </span>
                  </span>
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

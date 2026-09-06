import { motion } from "framer-motion"
import { Link } from "react-router-dom"
import {
  BookOpen,
  Bot,
  MessageSquarePlus,
  Ticket,
  Users,
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
    label: "Open tickets",
    description: "Triage and assign workspace tickets",
    href: "/dashboard/tickets",
    icon: Ticket,
  },
  {
    label: "View customers",
    description: "Open the workspace customer directory",
    href: "/dashboard/customers",
    icon: Users,
  },
  {
    label: "Open Knowledge Base",
    description: "Browse published support documents",
    href: "/dashboard/knowledge-base",
    icon: BookOpen,
  },
  {
    label: "Ask AI Assistant",
    description: "Get a knowledge-grounded answer",
    href: "/dashboard/ai-assistant",
    icon: Bot,
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
            Jump into workflows that are connected to the product today.
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

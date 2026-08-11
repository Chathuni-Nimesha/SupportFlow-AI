import { motion } from "framer-motion"
import {
  Activity,
  Inbox,
  MessageSquareText,
  TrendingUp,
  Users,
} from "lucide-react"

import { fadeUp } from "@/components/landing/motion"
import { SectionHeading } from "@/components/landing/section-heading"

const metrics = [
  { label: "Open tickets", value: "128", delta: "-18%", icon: Inbox },
  { label: "AI resolved", value: "76%", delta: "+9%", icon: Activity },
  { label: "Active agents", value: "14", delta: "Live", icon: Users },
  { label: "CSAT", value: "4.9", delta: "+0.3", icon: TrendingUp },
]

const rows = [
  { id: "#4821", topic: "Billing duplicate", status: "Resolved by AI", tone: "success" },
  { id: "#4820", topic: "Password reset", status: "Resolved by AI", tone: "success" },
  { id: "#4819", topic: "Enterprise SLA", status: "Escalated", tone: "warn" },
  { id: "#4818", topic: "Integrations FAQ", status: "Resolved by AI", tone: "success" },
]

export function DashboardPreview() {
  return (
    <section
      className="py-20 sm:py-24"
      aria-labelledby="dashboard-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="dashboard-heading"
          eyebrow="Product"
          title="A command center your team will actually enjoy"
          description="Monitor conversations, AI performance, and customer sentiment without leaving one polished view."
        />

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="relative mt-14 overflow-hidden rounded-2xl border border-border/80 bg-white p-3 shadow-soft-lg sm:p-5"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/8 to-transparent" />

          <div className="relative rounded-2xl border border-border/70 bg-background p-4 sm:p-6">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Operations
                </p>
                <h3 className="text-xl font-semibold text-foreground">
                  Support dashboard
                </h3>
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-white px-3 py-2 text-sm text-muted-foreground">
                <MessageSquareText className="size-4 text-primary" aria-hidden />
                Live inbox · last sync 2m ago
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {metrics.map((metric) => {
                const Icon = metric.icon
                return (
                  <div
                    key={metric.label}
                    className="rounded-2xl border border-border/80 bg-white p-4 shadow-soft"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">
                        {metric.label}
                      </p>
                      <Icon className="size-4 text-primary" aria-hidden />
                    </div>
                    <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                      {metric.value}
                    </p>
                    <p className="mt-1 text-xs font-medium text-emerald-600">
                      {metric.delta}
                    </p>
                  </div>
                )
              })}
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-border/80 bg-white">
              <div className="grid grid-cols-[auto_1fr_auto] gap-3 border-b border-border/70 bg-muted/40 px-4 py-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <span>Ticket</span>
                <span>Topic</span>
                <span>Status</span>
              </div>
              <ul>
                {rows.map((row) => (
                  <li
                    key={row.id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border/60 px-4 py-3 text-sm last:border-b-0"
                  >
                    <span className="font-medium text-foreground">{row.id}</span>
                    <span className="truncate text-muted-foreground">
                      {row.topic}
                    </span>
                    <span
                      className={
                        row.tone === "success"
                          ? "rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                          : "rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
                      }
                    >
                      {row.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

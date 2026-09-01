import { motion } from "framer-motion"
import {
  BookOpen,
  Bot,
  MessageSquareText,
  Search,
  Shield,
} from "lucide-react"

import { fadeUp } from "@/components/landing/motion"
import { SectionHeading } from "@/components/landing/section-heading"

const capabilities = [
  { label: "Conversations", value: "Inbox", icon: MessageSquareText },
  { label: "Knowledge Base", value: "Publish", icon: BookOpen },
  { label: "Semantic search", value: "Retrieve", icon: Search },
  { label: "AI assistance", value: "Suggest", icon: Bot },
]

const rows = [
  { subject: "Refund window question", status: "Open" },
  { subject: "Shipping SLA", status: "Waiting" },
  { subject: "Password reset steps", status: "Closed" },
  { subject: "Billing FAQ", status: "AI Resolved" },
]

export function DashboardPreview() {
  return (
    <section
      id="product"
      className="scroll-mt-24 py-20 sm:py-24"
      aria-labelledby="dashboard-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="dashboard-heading"
          eyebrow="Product"
          title="A workspace agents can actually use"
          description="Conversations, knowledge, and AI suggestions in one view. This preview shows the product shape — not live customer metrics."
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
                  Workspace
                </p>
                <h3 className="text-xl font-semibold text-foreground">
                  Agent dashboard
                </h3>
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-white px-3 py-2 text-sm text-muted-foreground">
                <Shield className="size-4 text-primary" aria-hidden />
                Owner-scoped · signed in
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {capabilities.map((item) => {
                const Icon = item.icon
                return (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-border/80 bg-white p-4 shadow-soft"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">
                        {item.label}
                      </p>
                      <Icon className="size-4 text-primary" aria-hidden />
                    </div>
                    <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                      {item.value}
                    </p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">
                      Included
                    </p>
                  </div>
                )
              })}
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-border/80 bg-white">
              <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-border/70 bg-muted/40 px-4 py-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <span>Conversation</span>
                <span>Status</span>
              </div>
              <ul>
                {rows.map((row) => (
                  <li
                    key={row.subject}
                    className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-border/60 px-4 py-3 text-sm last:border-b-0"
                  >
                    <span className="truncate text-foreground">{row.subject}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
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

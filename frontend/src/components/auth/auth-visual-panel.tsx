import { motion, useReducedMotion } from "framer-motion"
import {
  BookOpen,
  Bot,
  CheckCircle2,
  MessageSquare,
  Sparkles,
} from "lucide-react"

import { fadeUp, floatY } from "@/components/landing/motion"

const floatingCards = [
  {
    title: "Knowledge-grounded",
    value: "RAG",
    icon: BookOpen,
    className: "left-4 top-8 sm:left-8 sm:top-12",
  },
  {
    title: "Suggested replies",
    value: "Assist",
    icon: Sparkles,
    className: "right-4 top-28 sm:right-10 sm:top-32",
  },
  {
    title: "Workspace-scoped",
    value: "Secure",
    icon: MessageSquare,
    className: "bottom-10 left-6 sm:bottom-16 sm:left-12",
  },
]

export function AuthVisualPanel() {
  const reduceMotion = useReducedMotion()

  return (
    <aside
      className="relative hidden min-h-svh overflow-hidden bg-mesh lg:flex lg:items-center lg:justify-center"
      aria-hidden="true"
    >
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
      <div className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-10 size-80 rounded-full bg-indigo-300/30 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md px-10"
      >
        <div className="rounded-2xl border border-border/80 bg-white/90 p-5 shadow-soft-lg backdrop-blur">
          <div className="mb-5 flex items-center justify-between border-b border-border/70 pb-4">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Bot className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Agent workspace
                </p>
                <p className="text-xs text-muted-foreground">
                  Conversations, knowledge, and AI assistance
                </p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
              Review first
            </span>
          </div>

          <div className="space-y-3">
            {[
              "Publish a support document",
              "Generate a grounded suggested reply",
              "Review and send from the inbox",
            ].map((item, index) => (
              <motion.div
                key={item}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                transition={{ delay: 0.2 + index * 0.12 }}
                className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background px-3.5 py-3"
              >
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">{item}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Agent-assisted workflow
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {floatingCards.map((card, index) => {
          const Icon = card.icon
          return (
            <motion.div
              key={card.title}
              className={`absolute z-20 ${card.className}`}
              variants={reduceMotion ? undefined : floatY}
              initial={reduceMotion ? false : "initial"}
              animate={reduceMotion ? undefined : "animate"}
              transition={{ delay: index * 0.25 }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.55 + index * 0.12, duration: 0.45 }}
                className="flex min-w-[9.5rem] items-center gap-3 rounded-2xl border border-border/80 bg-white px-3.5 py-3 shadow-soft"
              >
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {card.value}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {card.title}
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )
        })}
      </motion.div>
    </aside>
  )
}

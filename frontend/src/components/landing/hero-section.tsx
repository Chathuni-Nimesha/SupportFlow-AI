import { motion, useReducedMotion } from "framer-motion"
import { ArrowRight, Bot, Clock3, MessageSquare, Sparkles } from "lucide-react"

import { fadeUp, floatY, staggerContainer } from "@/components/landing/motion"
import { Button } from "@/components/ui/button"

const chatMessages = [
  {
    from: "user" as const,
    text: "I was charged twice for my last invoice. Can you help?",
  },
  {
    from: "ai" as const,
    text: "I've found a duplicate charge on March 12. I can refund $49 now or credit your next invoice — which do you prefer?",
  },
  {
    from: "user" as const,
    text: "Refund it, please.",
  },
  {
    from: "ai" as const,
    text: "Done. Refund of $49 is processing and you'll get an email receipt in about 2 minutes.",
  },
]

const stats = [
  { label: "Resolved instantly", value: "87%", icon: Sparkles },
  { label: "Avg. response", value: "< 3s", icon: Clock3 },
  { label: "CSAT score", value: "4.9★", icon: MessageSquare },
]

export function HeroSection() {
  const reduceMotion = useReducedMotion()

  return (
    <section
      id="top"
      className="relative overflow-hidden bg-mesh pt-8 pb-20 sm:pt-12 sm:pb-28"
      aria-labelledby="hero-heading"
    >
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:px-8">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="max-w-xl"
        >
          <motion.p
            variants={fadeUp}
            className="mb-4 text-sm font-semibold tracking-[0.18em] text-primary uppercase"
          >
            SupportFlow AI
          </motion.p>
          <motion.h1
            id="hero-heading"
            variants={fadeUp}
            className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-[3.4rem] lg:leading-[1.08]"
          >
            AI Customer Support That Never Sleeps
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-5 max-w-lg text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            Resolve tickets in seconds with an AI agent trained on your docs,
            policies, and past conversations — so your team can focus on the
            conversations that matter.
          </motion.p>
          <motion.div
            variants={fadeUp}
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Button
              size="lg"
              className="h-12 rounded-2xl px-6 text-base shadow-soft"
            >
              Start free trial
              <ArrowRight data-icon="inline-end" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 rounded-2xl border-border bg-white/80 px-6 text-base backdrop-blur"
            >
              Book a demo
            </Button>
          </motion.div>
          <motion.p
            variants={fadeUp}
            className="mt-4 text-sm text-muted-foreground"
          >
            No credit card required · Setup in under 10 minutes
          </motion.p>
        </motion.div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
            className="relative rounded-2xl border border-border/80 bg-white p-4 shadow-soft-lg sm:p-5"
          >
            <div className="mb-4 flex items-center justify-between border-b border-border/70 pb-3">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Bot className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    SupportFlow Agent
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    Online · resolving live
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground">
                AI
              </span>
            </div>

            <div className="space-y-3" aria-label="AI chat mockup">
              {chatMessages.map((message, index) => (
                <motion.div
                  key={message.text}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 + index * 0.18, duration: 0.4 }}
                  className={
                    message.from === "user"
                      ? "ml-8 rounded-2xl rounded-br-md bg-muted px-3.5 py-2.5 text-sm text-foreground"
                      : "mr-6 rounded-2xl rounded-bl-md bg-primary px-3.5 py-2.5 text-sm text-primary-foreground shadow-soft"
                  }
                >
                  {message.text}
                </motion.div>
              ))}
            </div>
          </motion.div>

          {stats.map((stat, index) => {
            const Icon = stat.icon
            const positions = [
              "left-0 top-6 sm:-left-6 lg:-left-10",
              "right-0 top-1/2 sm:-right-4 lg:-right-8",
              "bottom-2 left-1/2 -translate-x-1/2 sm:bottom-0 sm:left-auto sm:right-8 sm:translate-x-0 lg:-bottom-4",
            ]

            return (
              <motion.div
                key={stat.label}
                className={`absolute z-10 ${positions[index]}`}
                variants={reduceMotion ? undefined : floatY}
                initial={reduceMotion ? false : "initial"}
                animate={reduceMotion ? undefined : "animate"}
                style={{ animationDelay: `${index * 0.4}s` }}
                transition={{ delay: index * 0.35 }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.8 + index * 0.15, duration: 0.45 }}
                  className="flex items-center gap-3 rounded-2xl border border-border/80 bg-white px-3.5 py-3 shadow-soft"
                >
                  <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {stat.value}
                    </p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </motion.div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

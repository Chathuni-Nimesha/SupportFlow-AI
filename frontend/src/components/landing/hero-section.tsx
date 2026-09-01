import { motion, useReducedMotion } from "framer-motion"
import { ArrowRight, BookOpen, Bot, MessageSquare, Sparkles } from "lucide-react"
import { Link } from "react-router-dom"

import { fadeUp, floatY, staggerContainer } from "@/components/landing/motion"
import { Button } from "@/components/ui/button"

const chatMessages = [
  {
    from: "user" as const,
    text: "What's your refund window for online orders?",
  },
  {
    from: "ai" as const,
    text: "Suggested reply from your knowledge base: refunds are available within 14 days of purchase. Review and send when you're ready.",
  },
]

const capabilities = [
  { label: "Knowledge-grounded answers", value: "RAG", icon: BookOpen },
  { label: "Suggested replies for agents", value: "Assist", icon: Sparkles },
  { label: "Owner-scoped workspace", value: "Secure", icon: MessageSquare },
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
            AI-powered customer support workspace
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-5 max-w-lg text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            Help agents work faster with centralized conversations, a published
            knowledge base, and retrieval-augmented suggestions they can review
            before sending.
          </motion.p>
          <motion.div
            variants={fadeUp}
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Button
              size="lg"
              className="h-12 rounded-2xl px-6 text-base shadow-soft"
              asChild
            >
              <Link to="/register">
                Get Started
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 rounded-2xl border-border bg-white/80 px-6 text-base backdrop-blur"
              asChild
            >
              <Link to="/login">Login</Link>
            </Button>
          </motion.div>
          <motion.p
            variants={fadeUp}
            className="mt-4 text-sm text-muted-foreground"
          >
            No credit card required. Create a workspace and start from your
            knowledge base.
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
                    AI suggestion
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    Grounded in published knowledge
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-secondary-foreground">
                Review
              </span>
            </div>

            <div className="space-y-3" aria-label="AI suggestion preview">
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

          {capabilities.map((item, index) => {
            const Icon = item.icon
            const positions = [
              "left-0 top-6 sm:-left-6 lg:-left-10",
              "right-0 top-1/2 sm:-right-4 lg:-right-8",
              "bottom-2 left-1/2 -translate-x-1/2 sm:bottom-0 sm:left-auto sm:right-8 sm:translate-x-0 lg:-bottom-4",
            ]

            return (
              <motion.div
                key={item.label}
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
                      {item.value}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
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

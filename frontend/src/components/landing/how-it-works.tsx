import { motion } from "framer-motion"
import { BookOpen, Bot, MessageSquarePlus, UserRound } from "lucide-react"

import { fadeUp, staggerContainer } from "@/components/landing/motion"
import { SectionHeading } from "@/components/landing/section-heading"

const steps = [
  {
    step: "01",
    title: "Create a workspace",
    description:
      "Register with email and password. Conversations, tickets, customers, and knowledge stay scoped to the selected workspace.",
    icon: UserRound,
  },
  {
    step: "02",
    title: "Publish knowledge",
    description:
      "Add support documents, publish them, and embed them for semantic retrieval.",
    icon: BookOpen,
  },
  {
    step: "03",
    title: "Work conversations",
    description:
      "Create threads, read messages, update status, and draft replies from the inbox.",
    icon: MessageSquarePlus,
  },
  {
    step: "04",
    title: "Ask or suggest with AI",
    description:
      "Generate a knowledge-grounded answer or suggested reply, then review it before sending.",
    icon: Bot,
  },
]

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-24 bg-white py-20 sm:py-24"
      aria-labelledby="how-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="how-heading"
          eyebrow="How it works"
          title="From knowledge to a reviewed reply"
          description="Four steps that match the product you can use today — no extra channels or billing required."
        />

        <motion.ol
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="relative mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4"
        >
          <div
            className="pointer-events-none absolute top-12 right-8 left-8 hidden h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent lg:block"
            aria-hidden
          />
          {steps.map((item) => {
            const Icon = item.icon
            return (
              <motion.li
                key={item.step}
                variants={fadeUp}
                className="relative rounded-2xl border border-border/80 bg-background p-6 shadow-soft"
              >
                <div className="mb-5 flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-soft">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="text-sm font-semibold text-primary/70">
                    {item.step}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </motion.li>
            )
          })}
        </motion.ol>
      </div>
    </section>
  )
}

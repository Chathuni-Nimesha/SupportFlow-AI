import { motion } from "framer-motion"
import { Link2, Rocket, Settings2, UploadCloud } from "lucide-react"

import { fadeUp, staggerContainer } from "@/components/landing/motion"
import { SectionHeading } from "@/components/landing/section-heading"

const steps = [
  {
    step: "01",
    title: "Connect your channels",
    description:
      "Plug in email, chat widget, Slack, or helpdesk tools in a few clicks.",
    icon: Link2,
  },
  {
    step: "02",
    title: "Upload knowledge",
    description:
      "Import docs, macros, and past tickets. We embed and index them securely.",
    icon: UploadCloud,
  },
  {
    step: "03",
    title: "Tune your agent",
    description:
      "Set tone, escalation rules, and guardrails so AI stays on-brand.",
    icon: Settings2,
  },
  {
    step: "04",
    title: "Go live & improve",
    description:
      "Launch instantly, monitor quality, and let continuous learning refine replies.",
    icon: Rocket,
  },
]

export function HowItWorks() {
  return (
    <section
      id="resources"
      className="scroll-mt-24 bg-white py-20 sm:py-24"
      aria-labelledby="how-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="how-heading"
          eyebrow="How it works"
          title="From setup to resolved — in four steps"
          description="A calm onboarding path designed for support leads, not engineers."
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

import { motion } from "framer-motion"
import { BookOpen, Bot, MessageSquare, Search } from "lucide-react"

import { fadeUp, staggerContainer } from "@/components/landing/motion"
import { SectionHeading } from "@/components/landing/section-heading"
import { Card, CardContent } from "@/components/ui/card"

const useCases = [
  {
    title: "Draft with knowledge",
    description:
      "Open a conversation, generate a suggested reply from published documents, then edit and send it yourself.",
    icon: MessageSquare,
  },
  {
    title: "Keep answers grounded",
    description:
      "Ask the AI assistant a policy question. It retrieves matching chunks and answers only from that context.",
    icon: Bot,
  },
  {
    title: "Find the right doc",
    description:
      "Publish FAQs and SOPs, then use semantic search when you need the exact passage — not a guess.",
    icon: Search,
  },
]

export function Testimonials() {
  return (
    <section
      id="about"
      className="scroll-mt-24 py-20 sm:py-24"
      aria-labelledby="testimonials-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="testimonials-heading"
          eyebrow="In practice"
          title="How agents use SupportFlow"
          description="Typical workflows in the current workspace — not customer case studies or CSAT results."
        />

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="mt-14 grid gap-6 md:grid-cols-3"
        >
          {useCases.map((item) => {
            const Icon = item.icon
            return (
              <motion.div key={item.title} variants={fadeUp}>
                <Card className="h-full rounded-2xl border-border/80 bg-white shadow-soft">
                  <CardContent className="flex h-full flex-col p-6">
                    <span className="mb-4 flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <h3 className="text-lg font-semibold text-foreground">
                      {item.title}
                    </h3>
                    <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                    <p className="mt-6 flex items-center gap-2 border-t border-border/70 pt-5 text-xs text-muted-foreground">
                      <BookOpen className="size-3.5" aria-hidden />
                      Requires published knowledge
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}

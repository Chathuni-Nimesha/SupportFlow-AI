import { motion } from "framer-motion"
import { BarChart3, BookOpen, MessageCircleHeart } from "lucide-react"

import { fadeUp, staggerContainer } from "@/components/landing/motion"
import { SectionHeading } from "@/components/landing/section-heading"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const features = [
  {
    title: "AI Chatbot",
    description:
      "A multilingual agent that answers instantly from your knowledge base, escalates edge cases, and mirrors your brand voice.",
    icon: MessageCircleHeart,
    points: ["24/7 autonomous replies", "Human handoff", "Tone controls"],
  },
  {
    title: "Knowledge Base",
    description:
      "Sync docs, FAQs, and SOPs. Retrieval stays fresh so answers cite the right source every time.",
    icon: BookOpen,
    points: ["Auto sync & embeddings", "Source citations", "Version awareness"],
  },
  {
    title: "Analytics",
    description:
      "See deflection rates, CSAT, and topic trends in one calm dashboard built for operators — not data scientists.",
    icon: BarChart3,
    points: ["Live performance", "Topic clustering", "Export-ready reports"],
  },
]

export function FeaturesSection() {
  return (
    <section
      id="features"
      className="scroll-mt-24 py-20 sm:py-24"
      aria-labelledby="features-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="features-heading"
          eyebrow="Features"
          title="Everything you need to deliver effortless support"
          description="Purpose-built modules that work together — from first reply to board-ready insights."
        />

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="mt-14 grid gap-6 md:grid-cols-3"
        >
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <motion.div key={feature.title} variants={fadeUp}>
                <Card className="h-full rounded-2xl border-border/80 bg-white shadow-soft transition-shadow hover:shadow-soft-lg">
                  <CardHeader className="gap-4">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div>
                      <CardTitle className="text-xl">{feature.title}</CardTitle>
                      <CardDescription className="mt-2 text-sm leading-relaxed">
                        {feature.description}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {feature.points.map((point) => (
                        <li
                          key={point}
                          className="flex items-center gap-2 text-sm text-muted-foreground"
                        >
                          <span className="size-1.5 rounded-full bg-primary" />
                          {point}
                        </li>
                      ))}
                    </ul>
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

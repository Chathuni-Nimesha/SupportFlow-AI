import { motion } from "framer-motion"
import {
  BookOpen,
  Bot,
  MessageSquare,
  Shield,
  Ticket,
  Users,
} from "lucide-react"

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
    title: "AI assistance",
    description:
      "Generate knowledge-grounded Gemini answers and suggested replies. Agents review every draft before anything is sent.",
    icon: Bot,
    points: ["RAG-powered answers", "Suggested replies", "Source citations"],
  },
  {
    title: "Knowledge Base",
    description:
      "Write, publish, and embed support documents. Semantic search retrieves the right chunks for agents and the AI assistant.",
    icon: BookOpen,
    points: ["CRUD and publishing", "Chroma embeddings", "Published-only retrieval"],
  },
  {
    title: "Conversations",
    description:
      "Keep customer threads in one inbox. Create conversations, send replies, and update status as work moves forward.",
    icon: MessageSquare,
    points: ["Messages and status", "AI-assisted drafts", "Workspace-scoped inbox"],
  },
  {
    title: "Tickets",
    description:
      "Track follow-up work with status, priority, and assignment to active workspace teammates.",
    icon: Ticket,
    points: ["Lifecycle and assignment", "Customer required", "Optional conversation link"],
  },
  {
    title: "Customers",
    description:
      "Maintain a workspace customer directory and see related conversations and tickets in one place.",
    icon: Users,
    points: ["Searchable directory", "Related threads", "Related tickets"],
  },
  {
    title: "Team and workspace",
    description:
      "Switch workspaces, isolate data by workspace, and manage a team directory with OWNER, ADMIN, and AGENT roles.",
    icon: Shield,
    points: [
      "Workspace data isolation",
      "Role-based management",
      "Directory for assignment, not login",
    ],
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
          title="What the workspace actually includes"
          description="Built for support agents: conversations, tickets, customers, knowledge, and retrieval-augmented assistance in one workspace-scoped product."
        />

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3"
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

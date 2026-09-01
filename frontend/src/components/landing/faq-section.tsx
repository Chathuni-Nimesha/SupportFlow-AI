import { motion } from "framer-motion"

import { fadeUp } from "@/components/landing/motion"
import { SectionHeading } from "@/components/landing/section-heading"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const faqs = [
  {
    question: "How does the AI use my knowledge?",
    answer:
      "You create and publish documents in the Knowledge Base. Published content is chunked and embedded, then retrieved when you ask the AI assistant or generate a suggested reply. The model answers from that context and does not invent policy when nothing relevant is found.",
  },
  {
    question: "Does the AI send replies to customers automatically?",
    answer:
      "No. Suggestions and answers are for agents to review. Inserting a suggestion into the composer and sending it is a manual step.",
  },
  {
    question: "Who can see my conversations and documents?",
    answer:
      "Data is scoped to the signed-in account. Other users cannot read your conversations, knowledge, customers, tickets, or team directory. Team members cannot sign in yet, and there is no SSO.",
  },
  {
    question: "Is there a public customer chat widget?",
    answer:
      "Not yet. Conversations are created and managed inside the signed-in workspace. There is no customer-facing chatbot, email channel, or Slack integration in this version.",
  },
  {
    question: "Are tickets, team, and billing included?",
    answer:
      "Customers, tickets, and a team directory are included and scoped to the signed-in owner. Tickets can be assigned to team members. Billing is not included, and team members cannot log in or receive email invitations yet.",
  },
]

export function FAQSection() {
  return (
    <section
      className="bg-white py-20 sm:py-24"
      aria-labelledby="faq-heading"
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="faq-heading"
          eyebrow="FAQ"
          title="Straight answers about this version"
          description="What the workspace does today — and what it does not claim to do."
        />

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="mt-12 rounded-2xl border border-border/80 bg-background p-2 shadow-soft sm:p-4"
        >
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={faq.question}
                value={`item-${index}`}
                className="border-border/70 px-3"
              >
                <AccordionTrigger className="text-left text-sm font-semibold hover:no-underline sm:text-base">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  )
}

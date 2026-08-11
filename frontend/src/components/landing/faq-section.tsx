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
    question: "How does SupportFlow AI learn my product?",
    answer:
      "Connect your help center, Notion/Google Docs, and past tickets. We embed and continuously re-index content so answers stay accurate as docs change.",
  },
  {
    question: "Can the AI escalate to a human agent?",
    answer:
      "Yes. Define confidence thresholds, sensitive topics, and VIP rules. When matched, conversations hand off with full context to your inbox or Slack.",
  },
  {
    question: "Is customer data secure?",
    answer:
      "Data is encrypted in transit and at rest. Enterprise plans include SSO, audit logs, regional data residency options, and custom retention policies.",
  },
  {
    question: "Which channels are supported?",
    answer:
      "Web chat, email, Slack, and major helpdesks. More channels are on the roadmap — Professional and Enterprise include priority access.",
  },
  {
    question: "Do I need engineers to launch?",
    answer:
      "No. Most teams go live in under a day with our guided setup. Developers can use webhooks and APIs when you need deeper customization.",
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
          title="Answers before you ask"
          description="Straight talk on setup, safety, and how AI fits into your support workflow."
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

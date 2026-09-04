import { motion } from "framer-motion"
import { Check } from "lucide-react"
import { Link } from "react-router-dom"

import { fadeUp, staggerContainer } from "@/components/landing/motion"
import { SectionHeading } from "@/components/landing/section-heading"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

const plans = [
  {
    name: "Workspace",
    price: "Free to try",
    period: "",
    description:
      "The current product: an authenticated agent workspace with knowledge-grounded AI assistance, plus customers, tickets, and a team directory.",
    features: [
      "Conversations and messages",
      "Customers, tickets, and team directory",
      "Knowledge Base CRUD and publishing",
      "Semantic knowledge search",
      "AI-assisted suggested replies",
      "RAG-powered answers",
      "Owner-scoped workspace",
    ],
    cta: "Get Started",
    href: "/register",
    highlighted: true,
    available: true,
  },
  {
    name: "Team",
    price: "Coming soon",
    period: "",
    description:
      "Email invitations, shared inboxes, and teammate login are not available in this version.",
    features: [
      "Team member directory (available now in the workspace)",
      "Invitations and member login",
      "Shared workspace controls",
    ],
    cta: "Coming soon",
    href: null,
    highlighted: false,
    available: false,
  },
  {
    name: "Enterprise",
    price: "Coming soon",
    period: "",
    description:
      "Billing, SSO, and dedicated success programs are not implemented yet.",
    features: [
      "Paid billing plans",
      "SSO and audit logs",
      "Custom SLAs",
    ],
    cta: "Coming soon",
    href: null,
    highlighted: false,
    available: false,
  },
]

export function PricingSection() {
  return (
    <section
      id="pricing"
      className="scroll-mt-24 bg-white py-20 sm:py-24"
      aria-labelledby="pricing-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="pricing-heading"
          eyebrow="Access"
          title="Start with a workspace. Paid plans are not live yet."
          description="Create an account to use the product today. Billing is not implemented — there is nothing to purchase."
        />

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          className="mt-14 grid gap-6 lg:grid-cols-3"
        >
          {plans.map((plan) => (
            <motion.div key={plan.name} variants={fadeUp}>
              <Card
                className={cn(
                  "relative h-full rounded-2xl border-border/80 bg-background shadow-soft",
                  plan.highlighted &&
                    "border-primary bg-white shadow-soft-lg ring-2 ring-primary/20 lg:-translate-y-2",
                )}
              >
                {plan.available ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-soft">
                    Available now
                  </span>
                ) : (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground shadow-soft">
                    Coming soon
                  </span>
                )}
                <CardHeader>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {plan.description}
                  </CardDescription>
                  <div className="mt-4 flex items-end gap-1">
                    <span className="text-3xl font-semibold tracking-tight text-foreground">
                      {plan.price}
                    </span>
                    {plan.period ? (
                      <span className="pb-1 text-sm text-muted-foreground">
                        {plan.period}
                      </span>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2.5 text-sm text-foreground"
                      >
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Check className="size-3.5" aria-hidden />
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  {plan.href ? (
                    <Button
                      className="h-11 w-full rounded-2xl"
                      variant={plan.highlighted ? "default" : "outline"}
                      asChild
                    >
                      <Link to={plan.href}>{plan.cta}</Link>
                    </Button>
                  ) : (
                    <Button
                      className="h-11 w-full rounded-2xl"
                      variant="outline"
                      disabled
                      title="This plan is not available yet."
                    >
                      {plan.cta}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

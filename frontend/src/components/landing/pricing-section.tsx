import { motion } from "framer-motion"
import { Check } from "lucide-react"

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
    name: "Starter",
    price: "$29",
    period: "/month",
    description: "For early teams launching AI support on a single channel.",
    features: [
      "1,000 AI resolutions / mo",
      "Chat widget + email",
      "Basic analytics",
      "Email support",
    ],
    cta: "Start with Starter",
    highlighted: false,
  },
  {
    name: "Professional",
    price: "$99",
    period: "/month",
    description: "For growing support orgs that need depth, control, and speed.",
    features: [
      "10,000 AI resolutions / mo",
      "All channels + Slack",
      "Advanced analytics",
      "Knowledge sync",
      "Priority support",
    ],
    cta: "Choose Professional",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "Security, SLAs, and dedicated success for large organizations.",
    features: [
      "Unlimited resolutions",
      "SSO & audit logs",
      "Custom models & guardrails",
      "Dedicated CSM",
      "99.9% uptime SLA",
    ],
    cta: "Talk to sales",
    highlighted: false,
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
          eyebrow="Pricing"
          title="Simple plans that scale with your inbox"
          description="Start free, upgrade when AI is resolving real volume. No surprise seat fees."
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
                {plan.highlighted ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-soft">
                    Most popular
                  </span>
                ) : null}
                <CardHeader>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {plan.description}
                  </CardDescription>
                  <div className="mt-4 flex items-end gap-1">
                    <span className="text-4xl font-semibold tracking-tight text-foreground">
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
                  <Button
                    className="h-11 w-full rounded-2xl"
                    variant={plan.highlighted ? "default" : "outline"}
                  >
                    {plan.cta}
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

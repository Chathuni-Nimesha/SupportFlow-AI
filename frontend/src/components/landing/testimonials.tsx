import { motion } from "framer-motion"
import { Star } from "lucide-react"

import { fadeUp, staggerContainer } from "@/components/landing/motion"
import { SectionHeading } from "@/components/landing/section-heading"
import { Card, CardContent } from "@/components/ui/card"

const testimonials = [
  {
    quote:
      "SupportFlow cut our first-response time from hours to seconds. Customers notice — and our CSAT jumped in the first month.",
    name: "Maya Chen",
    role: "Head of Support, Orbitly",
    initials: "MC",
  },
  {
    quote:
      "The knowledge sync actually works. Our AI cites the right policy every time, which finally made legal comfortable with automation.",
    name: "Jonah Pierce",
    role: "COO, Clearpath",
    initials: "JP",
  },
  {
    quote:
      "We evaluated three platforms. SupportFlow felt like Linear for support — fast, calm, and obsessively well designed.",
    name: "Aisha Rahman",
    role: "CX Lead, Harbor",
    initials: "AR",
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
          eyebrow="Testimonials"
          title="Loved by teams who obsess over customer experience"
          description="Real operators, shipping better support without adding headcount overnight."
        />

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="mt-14 grid gap-6 md:grid-cols-3"
        >
          {testimonials.map((item) => (
            <motion.div key={item.name} variants={fadeUp}>
              <Card className="h-full rounded-2xl border-border/80 bg-white shadow-soft">
                <CardContent className="flex h-full flex-col p-6">
                  <div
                    className="mb-4 flex gap-1 text-amber-400"
                    aria-label="5 out of 5 stars"
                  >
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star
                        key={index}
                        className="size-4 fill-current"
                        aria-hidden
                      />
                    ))}
                  </div>
                  <blockquote className="flex-1 text-sm leading-relaxed text-foreground sm:text-[15px]">
                    “{item.quote}”
                  </blockquote>
                  <div className="mt-6 flex items-center gap-3 border-t border-border/70 pt-5">
                    <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary">
                      {item.initials}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {item.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{item.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

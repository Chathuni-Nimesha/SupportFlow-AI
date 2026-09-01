import { motion } from "framer-motion"

import { fadeUp, staggerContainer } from "@/components/landing/motion"

const capabilities = [
  "Conversations",
  "Knowledge Base",
  "Semantic search",
  "RAG answers",
  "Suggested replies",
  "Secure login",
]

export function TrustedCompanies() {
  return (
    <section
      className="border-y border-border/70 bg-white py-12"
      aria-labelledby="trusted-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.4 }}
          className="text-center"
        >
          <motion.p
            id="trusted-heading"
            variants={fadeUp}
            className="text-sm font-medium tracking-wide text-muted-foreground"
          >
            Included in the workspace
          </motion.p>
          <motion.ul
            variants={staggerContainer}
            className="mt-8 grid grid-cols-2 items-center gap-4 sm:grid-cols-3 lg:grid-cols-6"
          >
            {capabilities.map((item) => (
              <motion.li
                key={item}
                variants={fadeUp}
                className="flex h-14 items-center justify-center rounded-2xl border border-transparent bg-muted/40 px-3 text-sm font-semibold tracking-tight text-slate-500 transition hover:border-border hover:bg-white hover:text-slate-700 hover:shadow-soft"
              >
                {item}
              </motion.li>
            ))}
          </motion.ul>
        </motion.div>
      </div>
    </section>
  )
}

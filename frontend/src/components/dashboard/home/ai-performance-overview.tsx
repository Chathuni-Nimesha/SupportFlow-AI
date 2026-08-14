import { motion } from "framer-motion"

import { UnavailablePanel } from "@/components/dashboard/home/unavailable-panel"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function AiPerformanceOverview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="rounded-2xl border-border/70 bg-card shadow-soft ring-border/60">
        <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <CardTitle className="text-lg">AI Performance Overview</CardTitle>
            <CardDescription className="mt-1">
              Weekly resolution trend across all support channels.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="overflow-hidden rounded-2xl bg-gradient-to-b from-primary/[0.06] to-transparent p-3 sm:p-4">
            <UnavailablePanel
              message="AI performance trends are not available yet. No resolution-rate backend exists."
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

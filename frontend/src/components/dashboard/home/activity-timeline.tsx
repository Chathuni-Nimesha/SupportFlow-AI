import { motion } from "framer-motion"

import { UnavailablePanel } from "@/components/dashboard/home/unavailable-panel"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function ActivityTimeline() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="h-full rounded-2xl border-border/70 bg-card shadow-soft ring-border/60">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-lg">Activity Timeline</CardTitle>
          <CardDescription className="mt-1">
            Recent conversation activity is not tracked as a timeline yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <UnavailablePanel
            message="Activity tracking is not available yet. No activity API exists."
          />
        </CardContent>
      </Card>
    </motion.div>
  )
}

import { motion } from "framer-motion"
import { Link } from "react-router-dom"

import { UnavailablePanel } from "@/components/dashboard/home/unavailable-panel"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function RecentTicketsTable() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="rounded-2xl border-border/70 bg-card shadow-soft ring-border/60">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <CardTitle className="text-lg">Recent Tickets</CardTitle>
            <CardDescription className="mt-1">
              Priority queue with current ownership and status.
            </CardDescription>
          </div>
          <Button variant="outline" className="rounded-2xl" asChild>
            <Link to="/dashboard/tickets">View all</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <UnavailablePanel
            message="Tickets are not available yet. There is no tickets backend connected."
          />
        </CardContent>
      </Card>
    </motion.div>
  )
}

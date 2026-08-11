import { motion } from "framer-motion"
import { Link } from "react-router-dom"

import { recentTickets, type TicketRow } from "@/data/dashboard-home"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

const priorityStyles: Record<TicketRow["priority"], string> = {
  Low: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
  Medium:
    "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  High: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  Urgent:
    "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
}

const statusStyles: Record<TicketRow["status"], string> = {
  Open: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  "In Progress":
    "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
  Waiting:
    "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  Closed:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
}

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
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-5">Ticket ID</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Assigned Agent</TableHead>
                <TableHead className="px-5 text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTickets.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="px-5">
                    <div>
                      <p className="font-medium text-foreground">{row.id}</p>
                      <p className="max-w-[10rem] truncate text-xs text-muted-foreground">
                        {row.subject}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "rounded-full border-0 font-medium",
                        priorityStyles[row.priority],
                      )}
                    >
                      {row.priority}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.agent}
                  </TableCell>
                  <TableCell className="px-5 text-right">
                    <Badge
                      variant="secondary"
                      className={cn(
                        "rounded-full border-0 font-medium",
                        statusStyles[row.status],
                      )}
                    >
                      {row.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </motion.div>
  )
}

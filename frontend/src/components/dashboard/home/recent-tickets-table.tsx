import { Loader2 } from "lucide-react"
import { motion } from "framer-motion"
import { Link } from "react-router-dom"

import { UnavailablePanel } from "@/components/dashboard/home/unavailable-panel"
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
import { formatRelativeTime } from "@/lib/conversation-mappers"
import {
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  assigneeLabel,
  ticketCustomerName,
} from "@/lib/ticket-mappers"
import { cn } from "@/lib/utils"
import type { Ticket, TicketStatus } from "@/types/tickets"

const statusStyles: Record<TicketStatus, string> = {
  OPEN: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  IN_PROGRESS:
    "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300",
  PENDING:
    "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  RESOLVED:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  CLOSED:
    "bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-300",
}

type RecentTicketsTableProps = {
  tickets: Ticket[]
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
}

export function RecentTicketsTable({
  tickets,
  isLoading = false,
  error = null,
  onRetry,
}: RecentTicketsTableProps) {
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
              Latest customer issues from your workspace.
            </CardDescription>
          </div>
          <Button variant="outline" className="rounded-2xl" asChild>
            <Link to="/dashboard/tickets">View all</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading tickets…
            </div>
          ) : error ? (
            <div className="px-5 py-8 text-center">
              <p className="text-sm font-medium text-foreground">
                Couldn’t load tickets
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{error}</p>
              {onRetry ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 rounded-xl"
                  onClick={onRetry}
                >
                  Retry
                </Button>
              ) : null}
            </div>
          ) : tickets.length === 0 ? (
            <UnavailablePanel
              title="No tickets yet"
              message="Create a ticket to see recent issues here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-5">Customer</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned to</TableHead>
                  <TableHead className="px-5 text-right">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="px-5 font-medium">
                      <div>
                        <p className="text-foreground">
                          {ticketCustomerName(row)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {TICKET_PRIORITY_LABELS[row.priority]}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[14rem] truncate text-muted-foreground">
                      {row.title}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "rounded-full border-0 font-medium",
                          statusStyles[row.status],
                        )}
                      >
                        {TICKET_STATUS_LABELS[row.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {assigneeLabel(row)}
                    </TableCell>
                    <TableCell className="px-5 text-right text-muted-foreground">
                      {formatRelativeTime(row.updated_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

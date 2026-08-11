import { MoreHorizontal, Eye } from "lucide-react"
import { motion } from "framer-motion"

import type { Ticket, TicketPriority, TicketStatus } from "@/data/tickets"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

const priorityStyles: Record<TicketPriority, string> = {
  Low: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
  Medium: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  High: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  Urgent: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
}

const statusStyles: Record<TicketStatus, string> = {
  Open: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  Pending:
    "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  "In Progress":
    "bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300",
  Resolved:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  Closed:
    "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
}

type TicketTableProps = {
  tickets: Ticket[]
  onOpenTicket: (ticket: Ticket) => void
}

export function TicketTable({ tickets, onOpenTicket }: TicketTableProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
      className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-soft"
    >
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-4">Ticket ID</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Assigned Agent</TableHead>
            <TableHead>Created Date</TableHead>
            <TableHead className="px-4 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.map((ticket) => (
            <TableRow
              key={ticket.id}
              className="cursor-pointer"
              onClick={() => onOpenTicket(ticket)}
            >
              <TableCell className="px-4 font-semibold text-foreground">
                {ticket.id}
              </TableCell>
              <TableCell>
                <div>
                  <p className="font-medium text-foreground">{ticket.customer}</p>
                  <p className="text-xs text-muted-foreground">
                    {ticket.customerEmail}
                  </p>
                </div>
              </TableCell>
              <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                {ticket.subject}
              </TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className={cn(
                    "rounded-full border-0 font-medium",
                    priorityStyles[ticket.priority],
                  )}
                >
                  {ticket.priority}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant="secondary"
                  className={cn(
                    "rounded-full border-0 font-medium",
                    statusStyles[ticket.status],
                  )}
                >
                  {ticket.status}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {ticket.agent}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {ticket.createdAt}
              </TableCell>
              <TableCell className="px-4 text-right" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="rounded-xl"
                      aria-label={`Actions for ${ticket.id}`}
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-2xl">
                    <DropdownMenuItem
                      className="rounded-xl"
                      onClick={() => onOpenTicket(ticket)}
                    >
                      <Eye className="size-4" />
                      View details
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </motion.div>
  )
}

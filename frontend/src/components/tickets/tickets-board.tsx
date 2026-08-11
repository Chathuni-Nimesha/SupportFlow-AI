import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"

import { TicketDetailDrawer } from "@/components/tickets/ticket-detail-drawer"
import { TicketEmptyState } from "@/components/tickets/ticket-empty-state"
import { TicketKpiCards } from "@/components/tickets/ticket-kpi-cards"
import { TicketTable } from "@/components/tickets/ticket-table"
import { TicketTableSkeleton } from "@/components/tickets/ticket-table-skeleton"
import { TicketToolbar } from "@/components/tickets/ticket-toolbar"
import {
  tickets as ticketData,
  type Ticket,
  type TicketFilter,
} from "@/data/tickets"

function matchesFilter(ticket: Ticket, filter: TicketFilter) {
  switch (filter) {
    case "open":
      return ticket.status === "Open" || ticket.status === "In Progress"
    case "pending":
      return ticket.status === "Pending"
    case "resolved":
      return ticket.status === "Resolved" || ticket.status === "Closed"
    case "high":
      return ticket.priority === "High" || ticket.priority === "Urgent"
    default:
      return true
  }
}

export function TicketsBoard() {
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<TicketFilter>("all")
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [createNotice, setCreateNotice] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 900)
    return () => window.clearTimeout(timer)
  }, [])

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase()

    return ticketData.filter((ticket) => {
      const matchesSearch =
        query.length === 0 ||
        ticket.id.toLowerCase().includes(query) ||
        ticket.customer.toLowerCase().includes(query) ||
        ticket.subject.toLowerCase().includes(query) ||
        ticket.agent.toLowerCase().includes(query)

      return matchesSearch && matchesFilter(ticket, filter)
    })
  }, [search, filter])

  const openTicket = (ticket: Ticket) => {
    setSelected(ticket)
    setDrawerOpen(true)
  }

  const resetFilters = () => {
    setSearch("")
    setFilter("all")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Tickets
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track, prioritize, and resolve customer issues across your workspace.
        </p>
      </div>

      <TicketKpiCards />
      <TicketToolbar
        search={search}
        filter={filter}
        onSearchChange={setSearch}
        onFilterChange={setFilter}
        onCreateTicket={() => {
          setCreateNotice(true)
          window.setTimeout(() => setCreateNotice(false), 2500)
        }}
      />

      <AnimatePresence>
        {createNotice ? (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary"
          >
            Create ticket is UI-only for now — no backend call was made.
          </motion.div>
        ) : null}
      </AnimatePresence>

      {loading ? (
        <TicketTableSkeleton />
      ) : filteredTickets.length === 0 ? (
        <TicketEmptyState onReset={resetFilters} />
      ) : (
        <TicketTable tickets={filteredTickets} onOpenTicket={openTicket} />
      )}

      <TicketDetailDrawer
        ticket={selected}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  )
}

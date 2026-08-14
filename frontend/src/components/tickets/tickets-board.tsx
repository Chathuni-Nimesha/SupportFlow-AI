import { TicketEmptyState } from "@/components/tickets/ticket-empty-state"
import { TicketKpiCards } from "@/components/tickets/ticket-kpi-cards"
import { TicketToolbar } from "@/components/tickets/ticket-toolbar"

export function TicketsBoard() {
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
      <TicketToolbar />

      <TicketEmptyState
        title="Not available"
        description="Tickets are not available yet. There is no tickets backend connected."
      />
    </div>
  )
}

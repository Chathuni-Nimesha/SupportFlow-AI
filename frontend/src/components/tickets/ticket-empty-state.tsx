import { Ticket } from "lucide-react"

import { Button } from "@/components/ui/button"

type TicketEmptyStateProps = {
  title?: string
  description?: string
  onReset?: () => void
}

export function TicketEmptyState({
  title = "No tickets found",
  description = "Try adjusting your search or filters to see more results.",
  onReset,
}: TicketEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center shadow-soft">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Ticket className="size-5" aria-hidden />
      </span>
      <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      {onReset ? (
        <Button
          type="button"
          variant="outline"
          className="mt-5 rounded-2xl"
          onClick={onReset}
        >
          Clear filters
        </Button>
      ) : null}
    </div>
  )
}

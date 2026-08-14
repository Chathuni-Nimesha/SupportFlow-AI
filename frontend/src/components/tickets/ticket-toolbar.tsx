import { Plus, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function TicketToolbar() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-soft sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full max-w-md">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value=""
              placeholder="Search tickets, customers, subjects…"
              aria-label="Search tickets"
              disabled
              className="h-10 rounded-2xl bg-background pl-9"
            />
          </div>

          <Select value="all" disabled>
            <SelectTrigger className="h-10 w-full rounded-2xl bg-background sm:w-44">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="all">All tickets</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="high">High priority</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          className="h-10 rounded-2xl shadow-soft"
          disabled
          title="Not available. There is no ticket creation API."
        >
          <Plus className="size-4" />
          Create ticket
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Search, filters, and ticket creation are unavailable until a tickets
        backend is connected.
      </p>
    </div>
  )
}

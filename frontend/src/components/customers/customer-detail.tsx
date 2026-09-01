import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  customerDisplayName,
  formatCustomerDate,
} from "@/lib/customer-mappers"
import {
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
} from "@/lib/ticket-mappers"
import { listTickets } from "@/services/tickets"
import type { CustomerDetail } from "@/types/customers"

type CustomerDetailPanelProps = {
  customer: CustomerDetail
  onEdit: () => void
  onClose: () => void
}

export function CustomerDetailPanel({
  customer,
  onEdit,
  onClose,
}: CustomerDetailPanelProps) {
  const name = customerDisplayName(customer)

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1">
        <div className="space-y-5 px-4 py-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {name}
            </h2>
            <p className="text-sm text-muted-foreground">{customer.email}</p>
            <p className="text-xs text-muted-foreground">
              Updated {formatCustomerDate(customer.updated_at)}
            </p>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2">
            <DetailField label="Phone" value={customer.phone} />
            <DetailField label="Company" value={customer.company} />
          </dl>

          <div className="rounded-2xl border border-border/80 bg-background p-4 shadow-soft">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Notes
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {customer.notes?.trim() || "No notes yet."}
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Related conversations
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Matched by email in this workspace. Conversations are not
                deleted when a customer is removed.
              </p>
            </div>
            {customer.conversations.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-sm text-muted-foreground">
                No conversations use this email yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {customer.conversations.map((conversation) => (
                  <li
                    key={conversation.id}
                    className="rounded-2xl border border-border/70 bg-background px-3.5 py-3"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {conversation.subject}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {conversation.status} · {conversation.channel}
                    </p>
                    {conversation.last_message ? (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {conversation.last_message}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <Button variant="outline" className="rounded-2xl" asChild>
              <Link to="/dashboard/conversations">Open conversations</Link>
            </Button>
          </div>

          <RelatedTickets customerId={customer.id} />
        </div>
      </ScrollArea>

      <div className="flex items-center justify-end gap-2 border-t border-border/70 px-4 py-3">
        <Button
          type="button"
          variant="outline"
          className="rounded-2xl"
          onClick={onClose}
        >
          Close
        </Button>
        <Button type="button" className="rounded-2xl" onClick={onEdit}>
          Edit customer
        </Button>
      </div>
    </div>
  )
}

function DetailField({
  label,
  value,
}: {
  label: string
  value: string | null
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background px-3.5 py-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-foreground">
        {value?.trim() || "—"}
      </dd>
    </div>
  )
}

function RelatedTickets({ customerId }: { customerId: string }) {
  const ticketsQuery = useQuery({
    queryKey: ["tickets", "list", { customerId }],
    queryFn: () => listTickets({ customerId }),
  })

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Related tickets
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Tickets created for this customer in this workspace.
        </p>
      </div>
      {ticketsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading tickets…</p>
      ) : ticketsQuery.isError ? (
        <p className="text-sm text-rose-700 dark:text-rose-300">
          Unable to load related tickets.
        </p>
      ) : ticketsQuery.data?.length ? (
        <ul className="space-y-2">
          {ticketsQuery.data.map((ticket) => (
            <li
              key={ticket.id}
              className="rounded-2xl border border-border/70 bg-background px-3.5 py-3"
            >
              <p className="text-sm font-medium text-foreground">
                {ticket.title}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {TICKET_STATUS_LABELS[ticket.status]} ·{" "}
                {TICKET_PRIORITY_LABELS[ticket.priority]}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          No tickets for this customer yet.
        </p>
      )}
      <Button variant="outline" className="rounded-2xl" asChild>
        <Link to="/dashboard/tickets">Open tickets</Link>
      </Button>
    </div>
  )
}

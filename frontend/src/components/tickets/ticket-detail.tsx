import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  assigneeLabel,
  conversationAssigneeLabel,
  formatTicketDate,
  ticketConversationLabel,
  ticketCustomerName,
  ticketNeedsConversationResolution,
} from "@/lib/ticket-mappers"
import { teamMemberDisplayName } from "@/lib/team-mappers"
import type { TeamMember } from "@/types/team"
import type { Ticket, TicketPriority, TicketStatus } from "@/types/tickets"
import { TICKET_PRIORITIES, TICKET_STATUSES } from "@/types/tickets"

const selectClassName =
  "h-11 w-full rounded-2xl border border-border/80 bg-background px-3 text-sm shadow-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"

type TicketDetailPanelProps = {
  ticket: Ticket
  onEdit: () => void
  onClose: () => void
  onStatusChange: (status: TicketStatus) => void
  onPriorityChange: (priority: TicketPriority) => void
  onAssigneeChange: (assigneeId: string | null) => void
  members: TeamMember[]
  membersLoading?: boolean
  isSaving?: boolean
  error?: string | null
}

export function TicketDetailPanel({
  ticket,
  onEdit,
  onClose,
  onStatusChange,
  onPriorityChange,
  onAssigneeChange,
  members,
  membersLoading = false,
  isSaving = false,
  error = null,
}: TicketDetailPanelProps) {
  const customerName = ticketCustomerName(ticket)
  const conversationLabel = ticketConversationLabel(ticket)
  const needsConversationResolution =
    ticketNeedsConversationResolution(ticket)

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1">
        <div className="space-y-5 px-4 py-4">
          {error ? (
            <p
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          {needsConversationResolution ? (
            <p
              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
              role="status"
            >
              This ticket is {TICKET_STATUS_LABELS[ticket.status].toLowerCase()},
              but the linked conversation is still{" "}
              {ticket.conversation_status ?? "open"}. Close the conversation
              separately if the thread is done.
            </p>
          ) : null}

          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {ticket.title}
            </h2>
            <p className="text-xs text-muted-foreground">
              Created {formatTicketDate(ticket.created_at)} · Updated{" "}
              {formatTicketDate(ticket.updated_at)}
            </p>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Customer
              </dt>
              <dd className="text-sm font-medium text-foreground">{customerName}</dd>
              {ticket.customer?.email ? (
                <dd className="text-xs text-muted-foreground">
                  {ticket.customer.email}
                </dd>
              ) : null}
            </div>
            <div className="space-y-1">
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Linked conversation
              </dt>
              <dd className="text-sm font-medium text-foreground">
                {conversationLabel}
              </dd>
              {ticket.conversation_id?.trim() ? (
                <dd>
                  <Button variant="link" className="h-auto px-0 text-xs" asChild>
                    <Link
                      to={`/dashboard/conversations?conversation=${encodeURIComponent(ticket.conversation_id)}`}
                    >
                      Open conversation
                    </Link>
                  </Button>
                </dd>
              ) : null}
            </div>
          </dl>

          <div className="rounded-2xl border border-border/80 bg-background p-4 shadow-soft">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Description
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {ticket.description}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ticket-detail-status">Status</Label>
              <select
                id="ticket-detail-status"
                value={ticket.status}
                onChange={(event) =>
                  onStatusChange(event.target.value as TicketStatus)
                }
                className={selectClassName}
                disabled={isSaving}
              >
                {TICKET_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {TICKET_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticket-detail-priority">Priority</Label>
              <select
                id="ticket-detail-priority"
                value={ticket.priority}
                onChange={(event) =>
                  onPriorityChange(event.target.value as TicketPriority)
                }
                className={selectClassName}
                disabled={isSaving}
              >
                {TICKET_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {TICKET_PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ticket-detail-assignee">Ticket assignee</Label>
            <p className="text-sm font-medium text-foreground">
              {assigneeLabel(ticket)}
            </p>
            <select
              id="ticket-detail-assignee"
              value={ticket.assignee_id ?? ""}
              onChange={(event) =>
                onAssigneeChange(event.target.value || null)
              }
              className={selectClassName}
              disabled={isSaving || membersLoading}
              aria-label="Assignee"
            >
              <option value="">
                {membersLoading ? "Loading team…" : "Unassigned"}
              </option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {teamMemberDisplayName(member)}
                  {member.role === "OWNER" ? " (Owner)" : ""}
                </option>
              ))}
            </select>
            {ticket.conversation_id?.trim() ? (
              <p className="text-xs text-muted-foreground">
                {conversationAssigneeLabel(ticket)}. Changing the ticket
                assignee does not change the conversation agent.
              </p>
            ) : null}
          </div>

          {ticket.resolved_at || ticket.resolution_note ? (
            <div className="rounded-2xl border border-border/80 bg-background p-4 shadow-soft">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Resolution
              </p>
              {ticket.resolved_at ? (
                <p className="mt-2 text-sm text-foreground">
                  Recorded {formatTicketDate(ticket.resolved_at)}
                </p>
              ) : null}
              {ticket.resolution_note ? (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {ticket.resolution_note}
                </p>
              ) : null}
            </div>
          ) : null}

          {ticket.customer ? (
            <Button variant="outline" className="rounded-2xl" asChild>
              <Link to="/dashboard/customers">View customer</Link>
            </Button>
          ) : null}
        </div>
      </ScrollArea>

      <div className="flex items-center justify-end gap-2 border-t border-border/70 px-4 py-3">
        <Button
          type="button"
          variant="outline"
          className="rounded-2xl"
          onClick={onClose}
          disabled={isSaving}
        >
          Close
        </Button>
        <Button
          type="button"
          className="rounded-2xl"
          onClick={onEdit}
          disabled={isSaving}
        >
          Edit ticket
        </Button>
      </div>
    </div>
  )
}

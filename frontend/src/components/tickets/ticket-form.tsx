import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { customerDisplayName } from "@/lib/customer-mappers"
import { teamMemberDisplayName } from "@/lib/team-mappers"
import {
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
} from "@/lib/ticket-mappers"
import type { Customer } from "@/types/customers"
import type { ConversationApi } from "@/types/conversations"
import type { TeamMember } from "@/types/team"
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketFormValues,
  type TicketPriority,
  type TicketStatus,
} from "@/types/tickets"

const selectClassName =
  "h-11 w-full rounded-2xl border border-border/80 bg-background px-3 text-sm shadow-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"

type TicketFormProps = {
  values: TicketFormValues
  onChange: (values: TicketFormValues) => void
  onSubmit: () => void
  onCancel: () => void
  submitLabel: string
  customers: Customer[]
  customersLoading?: boolean
  conversations?: ConversationApi[]
  conversationsLoading?: boolean
  members: TeamMember[]
  membersLoading?: boolean
  isSaving?: boolean
  error?: string | null
  lockCustomer?: boolean
  lockConversation?: boolean
}

export function TicketForm({
  values,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  customers,
  customersLoading = false,
  conversations = [],
  conversationsLoading = false,
  members,
  membersLoading = false,
  isSaving = false,
  error = null,
  lockCustomer = false,
  lockConversation = false,
}: TicketFormProps) {
  const update = <K extends keyof TicketFormValues>(
    key: K,
    value: TicketFormValues[K],
  ) => {
    onChange({ ...values, [key]: value })
  }

  const selectConversation = (conversationId: string) => {
    if (!conversationId) {
      onChange({ ...values, conversation_id: "" })
      return
    }
    const conversation = conversations.find((item) => item.id === conversationId)
    const next: TicketFormValues = {
      ...values,
      conversation_id: conversationId,
    }
    const linkedCustomerId = conversation?.customer_id?.trim()
    if (
      linkedCustomerId &&
      !lockCustomer &&
      customers.some((customer) => customer.id === linkedCustomerId)
    ) {
      next.customer_id = linkedCustomerId
    }
    onChange(next)
  }

  return (
    <form
      className="flex h-full flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {error ? (
          <p
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="ticket-customer">Customer</Label>
          <select
            id="ticket-customer"
            value={values.customer_id}
            onChange={(event) => update("customer_id", event.target.value)}
            className={selectClassName}
            disabled={isSaving || customersLoading || lockCustomer}
          >
            <option value="">
              {customersLoading ? "Loading customers…" : "Select a customer"}
            </option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customerDisplayName(customer)} · {customer.email}
              </option>
            ))}
          </select>
          {customers.length === 0 && !customersLoading ? (
            <p className="text-xs text-muted-foreground">
              Create a customer before opening a ticket.
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="ticket-conversation">Conversation (optional)</Label>
          <select
            id="ticket-conversation"
            value={values.conversation_id}
            onChange={(event) => selectConversation(event.target.value)}
            className={selectClassName}
            disabled={isSaving || conversationsLoading || lockConversation}
          >
            <option value="">
              {conversationsLoading
                ? "Loading conversations…"
                : "No linked conversation"}
            </option>
            {values.conversation_id &&
            !conversations.some(
              (conversation) => conversation.id === values.conversation_id,
            ) ? (
              <option value={values.conversation_id}>
                Linked conversation
              </option>
            ) : null}
            {conversations.map((conversation) => (
              <option key={conversation.id} value={conversation.id}>
                {conversation.subject} · {conversation.customer_name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ticket-title">Title</Label>
          <Input
            id="ticket-title"
            value={values.title}
            onChange={(event) => update("title", event.target.value)}
            placeholder="Refund not received"
            className="h-11 rounded-2xl"
            disabled={isSaving}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ticket-description">Description</Label>
          <Textarea
            id="ticket-description"
            value={values.description}
            onChange={(event) => update("description", event.target.value)}
            placeholder="What happened, and what does the customer need?"
            className="min-h-28 rounded-2xl"
            disabled={isSaving}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ticket-status">Status</Label>
            <select
              id="ticket-status"
              value={values.status}
              onChange={(event) =>
                update("status", event.target.value as TicketStatus)
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
            <Label htmlFor="ticket-priority">Priority</Label>
            <select
              id="ticket-priority"
              value={values.priority}
              onChange={(event) =>
                update("priority", event.target.value as TicketPriority)
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
          <Label htmlFor="ticket-assignee">Assignee</Label>
          <select
            id="ticket-assignee"
            value={values.assignee_id}
            onChange={(event) => update("assignee_id", event.target.value)}
            className={selectClassName}
            disabled={isSaving || membersLoading}
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
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border/70 px-4 py-3">
        <Button
          type="button"
          variant="outline"
          className="rounded-2xl"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="rounded-2xl"
          disabled={isSaving || customers.length === 0}
        >
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
          {isSaving ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  )
}

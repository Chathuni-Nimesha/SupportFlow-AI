import type {
  ConversationStatus,
} from "@/types/conversations"
import type {
  Ticket,
  TicketCreatePayload,
  TicketFormValues,
  TicketPriority,
  TicketStatus,
  TicketUpdatePayload,
} from "@/types/tickets"
import { TICKET_PRIORITIES, TICKET_STATUSES } from "@/types/tickets"

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  PENDING: "Pending",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
}

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
}

const TICKET_RESOLVED_STATUSES = new Set<TicketStatus>(["RESOLVED", "CLOSED"])
const TICKET_OPEN_STATUSES = new Set<TicketStatus>([
  "OPEN",
  "IN_PROGRESS",
  "PENDING",
])
const CONVERSATION_OPEN_STATUSES = new Set<ConversationStatus>([
  "Open",
  "Waiting",
])
const CONVERSATION_RESOLVED_STATUSES = new Set<ConversationStatus>([
  "Closed",
  "AI Resolved",
])

export function formatTicketDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function ticketCustomerName(ticket: Ticket): string {
  if (ticket.customer) {
    return `${ticket.customer.first_name} ${ticket.customer.last_name}`.trim()
  }
  return "Unknown customer"
}

export function isTicketResolved(status: TicketStatus): boolean {
  return TICKET_RESOLVED_STATUSES.has(status)
}

export function isTicketOpen(status: TicketStatus): boolean {
  return TICKET_OPEN_STATUSES.has(status)
}

export function isConversationThreadOpen(
  status: ConversationStatus,
): boolean {
  return CONVERSATION_OPEN_STATUSES.has(status)
}

export function isConversationThreadResolved(
  status: ConversationStatus,
): boolean {
  return CONVERSATION_RESOLVED_STATUSES.has(status)
}

export function ticketNeedsConversationResolution(ticket: {
  status: TicketStatus
  conversation_id?: string | null
  conversation_status?: string | null
  conversation_needs_resolution?: boolean | null
}): boolean {
  if (ticket.conversation_needs_resolution === true) return true
  if (ticket.conversation_needs_resolution === false) return false
  if (!ticket.conversation_id?.trim() || !ticket.conversation_status) {
    return false
  }
  return (
    isTicketResolved(ticket.status) &&
    isConversationThreadOpen(ticket.conversation_status as ConversationStatus)
  )
}

export function conversationHasOpenTickets(tickets: Ticket[]): boolean {
  return tickets.some((ticket) => isTicketOpen(ticket.status))
}

export function conversationTicketsAllResolved(tickets: Ticket[]): boolean {
  return (
    tickets.length > 0 && tickets.every((ticket) => isTicketResolved(ticket.status))
  )
}

export function emptyTicketFormValues(): TicketFormValues {
  return {
    customer_id: "",
    conversation_id: "",
    title: "",
    description: "",
    status: "OPEN",
    priority: "MEDIUM",
    assignee_id: "",
    resolution_note: "",
  }
}

export function ticketFormFromConversation(
  conversation: {
    id: string
    customerId?: string | null
    subject: string
    lastMessage?: string
    assignedAgentId?: string | null
  },
  options?: { assignableMemberIds?: Iterable<string> },
): TicketFormValues {
  const assigneeId = conversation.assignedAgentId?.trim() || ""
  const allowed = options?.assignableMemberIds
    ? new Set(options.assignableMemberIds)
    : null
  const canAssign = Boolean(
    assigneeId && (allowed === null || allowed.has(assigneeId)),
  )
  return {
    ...emptyTicketFormValues(),
    customer_id: conversation.customerId?.trim() || "",
    conversation_id: conversation.id,
    title: conversation.subject.trim(),
    description: (conversation.lastMessage || conversation.subject).trim(),
    assignee_id: canAssign ? assigneeId : "",
  }
}

export function formValuesFromTicket(ticket: Ticket): TicketFormValues {
  return {
    customer_id: ticket.customer_id,
    conversation_id: ticket.conversation_id ?? "",
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    assignee_id: ticket.assignee_id ?? "",
    resolution_note: ticket.resolution_note ?? "",
  }
}

export function optionalAssignee(value: string): string | null {
  const cleaned = value.trim()
  return cleaned.length > 0 ? cleaned : null
}

export function toCreatePayload(values: TicketFormValues): TicketCreatePayload {
  const payload: TicketCreatePayload = {
    customer_id: values.customer_id.trim(),
    title: values.title.trim(),
    description: values.description.trim(),
    status: values.status,
    priority: values.priority,
    assignee_id: optionalAssignee(values.assignee_id),
  }
  const conversationId = optionalAssignee(values.conversation_id)
  if (conversationId) {
    payload.conversation_id = conversationId
  }
  const resolutionNote = optionalAssignee(values.resolution_note)
  if (resolutionNote) {
    payload.resolution_note = resolutionNote
  }
  return payload
}

export function toUpdatePayload(values: TicketFormValues): TicketUpdatePayload {
  return {
    ...toCreatePayload(values),
    conversation_id: optionalAssignee(values.conversation_id),
    resolution_note: optionalAssignee(values.resolution_note),
  }
}

export function validateTicketForm(values: TicketFormValues): string | null {
  if (!values.customer_id.trim()) return "Select a customer."
  if (!values.title.trim()) return "Title is required."
  if (!values.description.trim()) return "Description is required."
  if (!(TICKET_STATUSES as readonly string[]).includes(values.status)) {
    return "Invalid status."
  }
  if (!(TICKET_PRIORITIES as readonly string[]).includes(values.priority)) {
    return "Invalid priority."
  }
  return null
}

export function ticketConversationLabel(ticket: {
  conversation_id?: string | null
}): string {
  const conversationId = ticket.conversation_id?.trim()
  if (!conversationId) return "Not linked"
  return `Linked · ${conversationId}`
}

export function assigneeLabel(ticket: {
  assignee_id: string | null
  assignee?: { first_name: string; last_name: string } | null
}): string {
  if (!ticket.assignee_id) return "Unassigned"
  if (ticket.assignee) {
    return `${ticket.assignee.first_name} ${ticket.assignee.last_name}`.trim()
  }
  return "Assigned"
}

export function conversationAssigneeLabel(ticket: {
  conversation_assigned_agent_id?: string | null
  conversation_id?: string | null
}): string {
  if (!ticket.conversation_id?.trim()) return "No linked conversation"
  if (!ticket.conversation_assigned_agent_id?.trim()) {
    return "Conversation unassigned"
  }
  return "Conversation has an assigned agent"
}

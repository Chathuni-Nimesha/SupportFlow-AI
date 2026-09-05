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

export function emptyTicketFormValues(): TicketFormValues {
  return {
    customer_id: "",
    conversation_id: "",
    title: "",
    description: "",
    status: "OPEN",
    priority: "MEDIUM",
    assignee_id: "",
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
  return payload
}

export function toUpdatePayload(values: TicketFormValues): TicketUpdatePayload {
  return {
    ...toCreatePayload(values),
    conversation_id: optionalAssignee(values.conversation_id),
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

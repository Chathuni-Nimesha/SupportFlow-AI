export const TICKET_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "PENDING",
  "RESOLVED",
  "CLOSED",
] as const

export const TICKET_PRIORITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
] as const

export type TicketStatus = (typeof TICKET_STATUSES)[number]
export type TicketPriority = (typeof TICKET_PRIORITIES)[number]

export type TicketCustomerSummary = {
  id: string
  first_name: string
  last_name: string
  email: string
}

export type TicketAssigneeSummary = {
  id: string
  first_name: string
  last_name: string
  email: string
  role: string
}

export type Ticket = {
  id: string
  owner_id: string
  workspace_id?: string
  customer_id: string
  conversation_id?: string | null
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  assignee_id: string | null
  resolved_at?: string | null
  resolution_note?: string | null
  conversation_status?: string | null
  conversation_assigned_agent_id?: string | null
  conversation_needs_resolution?: boolean | null
  created_at: string
  updated_at: string
  customer: TicketCustomerSummary | null
  assignee: TicketAssigneeSummary | null
}

export type TicketCreatePayload = {
  customer_id: string
  title: string
  description: string
  status?: TicketStatus
  priority?: TicketPriority
  assignee_id?: string | null
  conversation_id?: string | null
  resolution_note?: string | null
}

export type TicketUpdatePayload = {
  customer_id?: string
  title?: string
  description?: string
  status?: TicketStatus
  priority?: TicketPriority
  assignee_id?: string | null
  conversation_id?: string | null
  resolution_note?: string | null
}

export type TicketListParams = {
  query?: string
  status?: TicketStatus
  priority?: TicketPriority
  assigneeId?: string
  unassigned?: boolean
  customerId?: string
  conversationId?: string
  page?: number
  pageSize?: number
}

export type TicketFormValues = {
  customer_id: string
  conversation_id: string
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  assignee_id: string
  resolution_note: string
}

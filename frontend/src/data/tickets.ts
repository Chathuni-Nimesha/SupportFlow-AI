export type TicketPriority = "Low" | "Medium" | "High" | "Urgent"
export type TicketStatus =
  | "Open"
  | "Pending"
  | "In Progress"
  | "Resolved"
  | "Closed"

export type TicketFilter = "all" | "open" | "pending" | "resolved" | "high"

export type TicketEventType =
  | "created"
  | "comment"
  | "note"
  | "status"
  | "assignment"
  | "attachment"
  | "priority"

export type TicketEvent = {
  id: string
  type: TicketEventType
  title: string
  description: string
  actor: string
  timestamp: string
}

export type TicketComment = {
  id: string
  author: string
  body: string
  timestamp: string
  internal?: boolean
}

export type TicketAttachment = {
  id: string
  name: string
  size: string
  uploadedBy: string
  uploadedAt: string
}

export type Ticket = {
  id: string
  customer: string
  customerEmail: string
  subject: string
  priority: TicketPriority
  status: TicketStatus
  agent: string
  createdAt: string
  updatedAt: string
  description: string
  comments: TicketComment[]
  notes: TicketComment[]
  attachments: TicketAttachment[]
  timeline: TicketEvent[]
  history: TicketEvent[]
}

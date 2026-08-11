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

export const ticketKpis = [
  {
    id: "open",
    label: "Open Tickets",
    value: "42",
    change: "+6",
    helper: "vs yesterday",
  },
  {
    id: "pending",
    label: "Pending",
    value: "17",
    change: "-3",
    helper: "awaiting customer",
  },
  {
    id: "resolved",
    label: "Resolved Today",
    value: "29",
    change: "+11",
    helper: "closed in last 24h",
  },
  {
    id: "high",
    label: "High Priority",
    value: "8",
    change: "+2",
    helper: "needs attention",
  },
] as const

export const tickets: Ticket[] = [
  {
    id: "TKT-4821",
    customer: "Acme Corp",
    customerEmail: "elena@acmecorp.com",
    subject: "Duplicate invoice charge for March",
    priority: "High",
    status: "Open",
    agent: "AI Agent",
    createdAt: "Mar 12, 2026",
    updatedAt: "2 min ago",
    description:
      "Customer reports two identical charges on the March invoice and is requesting a refund for the duplicate payment.",
    comments: [
      {
        id: "c1",
        author: "Elena Park",
        body: "We were charged twice for INV-3041. Please refund one of them.",
        timestamp: "10:12 AM",
      },
      {
        id: "c2",
        author: "AI Agent",
        body: "I verified the duplicate charge and prepared a refund path. Awaiting confirmation to proceed.",
        timestamp: "10:14 AM",
      },
    ],
    notes: [
      {
        id: "n1",
        author: "Jordan Lee",
        body: "Processor shows both charges settled. Safe to refund the DUP invoice.",
        timestamp: "10:20 AM",
        internal: true,
      },
    ],
    attachments: [
      {
        id: "a1",
        name: "march-invoice.pdf",
        size: "248 KB",
        uploadedBy: "Elena Park",
        uploadedAt: "Mar 12, 2026",
      },
    ],
    timeline: [
      {
        id: "t1",
        type: "created",
        title: "Ticket created",
        description: "Opened from chat conversation conv-1.",
        actor: "System",
        timestamp: "10:12 AM",
      },
      {
        id: "t2",
        type: "assignment",
        title: "Assigned to AI Agent",
        description: "Auto-routed based on billing intent.",
        actor: "Routing",
        timestamp: "10:12 AM",
      },
      {
        id: "t3",
        type: "comment",
        title: "Customer replied",
        description: "Requested refund for duplicate charge.",
        actor: "Elena Park",
        timestamp: "10:14 AM",
      },
    ],
    history: [
      {
        id: "h1",
        type: "status",
        title: "Status set to Open",
        description: "Initial status after intake.",
        actor: "System",
        timestamp: "Mar 12, 2026 · 10:12 AM",
      },
      {
        id: "h2",
        type: "assignment",
        title: "Assignee changed",
        description: "Assigned to AI Agent.",
        actor: "Routing",
        timestamp: "Mar 12, 2026 · 10:12 AM",
      },
    ],
  },
  {
    id: "TKT-4820",
    customer: "Orbitly",
    customerEmail: "marcus@orbitly.io",
    subject: "Production outage on checkout API",
    priority: "Urgent",
    status: "In Progress",
    agent: "Jordan Lee",
    createdAt: "Mar 12, 2026",
    updatedAt: "18 min ago",
    description:
      "Checkout API returning 500s for EU region. Customer reports revenue impact and requests status updates every 30 minutes.",
    comments: [
      {
        id: "c1",
        author: "Marcus Webb",
        body: "Checkout is down for EU customers. This is urgent.",
        timestamp: "9:40 AM",
      },
      {
        id: "c2",
        author: "Jordan Lee",
        body: "We identified a failing dependency and are rolling a hotfix.",
        timestamp: "9:55 AM",
      },
    ],
    notes: [
      {
        id: "n1",
        author: "Jordan Lee",
        body: "Incident channel #inc-4820 opened. ETA 25 minutes.",
        timestamp: "9:58 AM",
        internal: true,
      },
    ],
    attachments: [
      {
        id: "a1",
        name: "error-trace.txt",
        size: "64 KB",
        uploadedBy: "Marcus Webb",
        uploadedAt: "Mar 12, 2026",
      },
      {
        id: "a2",
        name: "region-metrics.png",
        size: "1.1 MB",
        uploadedBy: "Jordan Lee",
        uploadedAt: "Mar 12, 2026",
      },
    ],
    timeline: [
      {
        id: "t1",
        type: "created",
        title: "Ticket created",
        description: "Escalated from monitoring alert.",
        actor: "System",
        timestamp: "9:40 AM",
      },
      {
        id: "t2",
        type: "status",
        title: "Moved to In Progress",
        description: "Engineering acknowledged the incident.",
        actor: "Jordan Lee",
        timestamp: "9:45 AM",
      },
    ],
    history: [
      {
        id: "h1",
        type: "status",
        title: "Open → In Progress",
        description: "Jordan Lee started investigation.",
        actor: "Jordan Lee",
        timestamp: "Mar 12, 2026 · 9:45 AM",
      },
      {
        id: "h2",
        type: "priority",
        title: "Priority set to Urgent",
        description: "Customer impact confirmed.",
        actor: "System",
        timestamp: "Mar 12, 2026 · 9:41 AM",
      },
    ],
  },
  {
    id: "TKT-4819",
    customer: "Clearpath",
    customerEmail: "jonah@clearpath.co",
    subject: "Seat upgrade quote for 40 agents",
    priority: "Medium",
    status: "Pending",
    agent: "Sam Rivera",
    createdAt: "Mar 11, 2026",
    updatedAt: "1 hr ago",
    description:
      "Customer wants a quote and timeline for upgrading from Professional to Enterprise with 40 agent seats.",
    comments: [
      {
        id: "c1",
        author: "Jonah Pierce",
        body: "Can you send pricing for 40 seats with SSO included?",
        timestamp: "Yesterday",
      },
    ],
    notes: [
      {
        id: "n1",
        author: "Sam Rivera",
        body: "Waiting on sales desk discount approval before sending quote.",
        timestamp: "Today",
        internal: true,
      },
    ],
    attachments: [],
    timeline: [
      {
        id: "t1",
        type: "created",
        title: "Ticket created",
        description: "Opened from email.",
        actor: "System",
        timestamp: "Yesterday",
      },
      {
        id: "t2",
        type: "status",
        title: "Marked Pending",
        description: "Awaiting internal pricing approval.",
        actor: "Sam Rivera",
        timestamp: "Today",
      },
    ],
    history: [
      {
        id: "h1",
        type: "assignment",
        title: "Assigned to Sam Rivera",
        description: "Sales-assist queue.",
        actor: "Routing",
        timestamp: "Mar 11, 2026 · 4:10 PM",
      },
    ],
  },
  {
    id: "TKT-4818",
    customer: "Harbor Labs",
    customerEmail: "priya@harborlabs.com",
    subject: "Password reset flow clarification",
    priority: "Low",
    status: "Resolved",
    agent: "AI Agent",
    createdAt: "Mar 11, 2026",
    updatedAt: "3 hr ago",
    description:
      "Customer asked whether SSO users can use password reset. Resolved with documentation links.",
    comments: [
      {
        id: "c1",
        author: "Priya Nair",
        body: "Do SSO users need a local password?",
        timestamp: "Yesterday",
      },
      {
        id: "c2",
        author: "AI Agent",
        body: "No — SSO users authenticate via IdP only. Shared the setup guide.",
        timestamp: "Yesterday",
      },
    ],
    notes: [],
    attachments: [
      {
        id: "a1",
        name: "sso-guide.pdf",
        size: "420 KB",
        uploadedBy: "AI Agent",
        uploadedAt: "Mar 11, 2026",
      },
    ],
    timeline: [
      {
        id: "t1",
        type: "created",
        title: "Ticket created",
        description: "Auto-created from AI chat.",
        actor: "System",
        timestamp: "Yesterday",
      },
      {
        id: "t2",
        type: "status",
        title: "Resolved",
        description: "Customer confirmed the answer.",
        actor: "AI Agent",
        timestamp: "3 hr ago",
      },
    ],
    history: [
      {
        id: "h1",
        type: "status",
        title: "Open → Resolved",
        description: "Closed by AI with CSAT 5/5.",
        actor: "AI Agent",
        timestamp: "Mar 12, 2026 · 8:02 AM",
      },
    ],
  },
  {
    id: "TKT-4817",
    customer: "Voltware",
    customerEmail: "aisha@voltware.com",
    subject: "EU data residency for Enterprise",
    priority: "High",
    status: "Open",
    agent: "Aisha Rahman",
    createdAt: "Mar 10, 2026",
    updatedAt: "Yesterday",
    description:
      "Enterprise prospect needs confirmation of Frankfurt residency, DPA terms, and migration timeline.",
    comments: [
      {
        id: "c1",
        author: "Chris Nolan",
        body: "Still waiting on the data residency answer.",
        timestamp: "Yesterday",
      },
    ],
    notes: [
      {
        id: "n1",
        author: "Aisha Rahman",
        body: "Legal approved Frankfurt residency language. Send packet today.",
        timestamp: "Yesterday",
        internal: true,
      },
    ],
    attachments: [
      {
        id: "a1",
        name: "dpa-draft.docx",
        size: "188 KB",
        uploadedBy: "Aisha Rahman",
        uploadedAt: "Mar 11, 2026",
      },
    ],
    timeline: [
      {
        id: "t1",
        type: "created",
        title: "Ticket created",
        description: "Opened from enterprise email.",
        actor: "System",
        timestamp: "Mar 10",
      },
      {
        id: "t2",
        type: "assignment",
        title: "Assigned to Aisha Rahman",
        description: "Enterprise specialist queue.",
        actor: "Routing",
        timestamp: "Mar 10",
      },
    ],
    history: [
      {
        id: "h1",
        type: "priority",
        title: "Priority raised to High",
        description: "Deal desk requested faster turnaround.",
        actor: "Sam Rivera",
        timestamp: "Mar 11, 2026 · 11:20 AM",
      },
    ],
  },
  {
    id: "TKT-4816",
    customer: "Nimbus",
    customerEmail: "leo@nimbus.app",
    subject: "Safari widget rendering issue",
    priority: "Medium",
    status: "Closed",
    agent: "Sam Rivera",
    createdAt: "Mar 9, 2026",
    updatedAt: "2 days ago",
    description:
      "Chat widget failed to load on Safari 16. Fixed in release 1.18.2 and confirmed by customer.",
    comments: [
      {
        id: "c1",
        author: "Leo Andersen",
        body: "Closing this out — issue resolved on our side.",
        timestamp: "2 days ago",
      },
    ],
    notes: [],
    attachments: [],
    timeline: [
      {
        id: "t1",
        type: "created",
        title: "Ticket created",
        description: "Reported via chat.",
        actor: "System",
        timestamp: "Mar 9",
      },
      {
        id: "t2",
        type: "status",
        title: "Closed",
        description: "Customer confirmed fix.",
        actor: "Leo Andersen",
        timestamp: "2 days ago",
      },
    ],
    history: [
      {
        id: "h1",
        type: "status",
        title: "Resolved → Closed",
        description: "Auto-closed after confirmation.",
        actor: "System",
        timestamp: "Mar 10, 2026 · 3:15 PM",
      },
    ],
  },
  {
    id: "TKT-4815",
    customer: "Lumen Labs",
    customerEmail: "sofia@lumenlabs.io",
    subject: "Webhook signature validation failing",
    priority: "High",
    status: "Pending",
    agent: "Jordan Lee",
    createdAt: "Mar 12, 2026",
    updatedAt: "40 min ago",
    description:
      "Customer can’t validate webhook signatures after rotating secrets. Waiting on sample payload.",
    comments: [
      {
        id: "c1",
        author: "Sofia Mendes",
        body: "Signatures fail after secret rotation. Can you review?",
        timestamp: "Today",
      },
      {
        id: "c2",
        author: "Jordan Lee",
        body: "Please share one signed payload and the timestamp header.",
        timestamp: "40 min ago",
      },
    ],
    notes: [
      {
        id: "n1",
        author: "Jordan Lee",
        body: "Likely using old secret in staging. Waiting on sample.",
        timestamp: "35 min ago",
        internal: true,
      },
    ],
    attachments: [],
    timeline: [
      {
        id: "t1",
        type: "created",
        title: "Ticket created",
        description: "Opened from developer portal.",
        actor: "System",
        timestamp: "Today",
      },
      {
        id: "t2",
        type: "status",
        title: "Pending customer",
        description: "Requested signed payload sample.",
        actor: "Jordan Lee",
        timestamp: "40 min ago",
      },
    ],
    history: [
      {
        id: "h1",
        type: "status",
        title: "Open → Pending",
        description: "Waiting on customer artifact.",
        actor: "Jordan Lee",
        timestamp: "Mar 12, 2026 · 10:05 AM",
      },
    ],
  },
  {
    id: "TKT-4814",
    customer: "Harbor",
    customerEmail: "ops@harbor.co",
    subject: "Export analytics for Q1 board pack",
    priority: "Low",
    status: "Resolved",
    agent: "AI Agent",
    createdAt: "Mar 8, 2026",
    updatedAt: "4 days ago",
    description:
      "Customer needed CSV export for Q1 leadership review. Delivered via AI with follow-up email.",
    comments: [
      {
        id: "c1",
        author: "Ops Team",
        body: "Can you send Q1 analytics as CSV?",
        timestamp: "4 days ago",
      },
    ],
    notes: [],
    attachments: [
      {
        id: "a1",
        name: "q1-analytics.csv",
        size: "86 KB",
        uploadedBy: "AI Agent",
        uploadedAt: "Mar 8, 2026",
      },
    ],
    timeline: [
      {
        id: "t1",
        type: "created",
        title: "Ticket created",
        description: "From analytics page CTA.",
        actor: "System",
        timestamp: "Mar 8",
      },
      {
        id: "t2",
        type: "attachment",
        title: "CSV attached",
        description: "q1-analytics.csv uploaded.",
        actor: "AI Agent",
        timestamp: "Mar 8",
      },
    ],
    history: [
      {
        id: "h1",
        type: "status",
        title: "Open → Resolved",
        description: "Export delivered.",
        actor: "AI Agent",
        timestamp: "Mar 8, 2026 · 2:40 PM",
      },
    ],
  },
]

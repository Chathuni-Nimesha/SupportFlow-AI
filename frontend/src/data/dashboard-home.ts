export type TrendDirection = "up" | "down" | "neutral"

export type KpiMetric = {
  id: string
  label: string
  value: string
  change: string
  trend: TrendDirection
  helper: string
}

export type ConversationRow = {
  id: string
  customer: string
  subject: string
  status: "Resolved" | "Open" | "Pending" | "Escalated"
  updatedAt: string
  channel: string
}

export type TicketRow = {
  id: string
  priority: "Low" | "Medium" | "High" | "Urgent"
  agent: string
  status: "Open" | "In Progress" | "Waiting" | "Closed"
  subject: string
}

export type ActivityItem = {
  id: string
  title: string
  description: string
  time: string
  type: "ai" | "ticket" | "team" | "system"
}

export type ChartPoint = {
  label: string
  value: number
}

export const dashboardKpis: KpiMetric[] = [
  {
    id: "conversations",
    label: "Total Conversations",
    value: "2,847",
    change: "+12.4%",
    trend: "up",
    helper: "vs last week",
  },
  {
    id: "tickets",
    label: "Open Tickets",
    value: "128",
    change: "-8.1%",
    trend: "down",
    helper: "vs last week",
  },
  {
    id: "ai-rate",
    label: "AI Resolution Rate",
    value: "87%",
    change: "+4.2%",
    trend: "up",
    helper: "auto-resolved",
  },
  {
    id: "csat",
    label: "CSAT",
    value: "4.9",
    change: "+0.2",
    trend: "up",
    helper: "out of 5.0",
  },
]

export const aiPerformanceSeries: ChartPoint[] = [
  { label: "Mon", value: 62 },
  { label: "Tue", value: 71 },
  { label: "Wed", value: 68 },
  { label: "Thu", value: 79 },
  { label: "Fri", value: 84 },
  { label: "Sat", value: 76 },
  { label: "Sun", value: 87 },
]

export const recentConversations: ConversationRow[] = [
  {
    id: "c1",
    customer: "Acme Corp",
    subject: "Duplicate invoice charge",
    status: "Resolved",
    updatedAt: "2 min ago",
    channel: "Chat",
  },
  {
    id: "c2",
    customer: "Orbitly",
    subject: "SSO login failing for admins",
    status: "Escalated",
    updatedAt: "14 min ago",
    channel: "Email",
  },
  {
    id: "c3",
    customer: "Harbor Labs",
    subject: "How to export analytics?",
    status: "Resolved",
    updatedAt: "28 min ago",
    channel: "Chat",
  },
  {
    id: "c4",
    customer: "Clearpath",
    subject: "API rate limit confusion",
    status: "Pending",
    updatedAt: "1 hr ago",
    channel: "Slack",
  },
  {
    id: "c5",
    customer: "Voltware",
    subject: "Update billing contact",
    status: "Open",
    updatedAt: "2 hr ago",
    channel: "Email",
  },
]

export const recentTickets: TicketRow[] = [
  {
    id: "#4821",
    priority: "High",
    agent: "AI Agent",
    status: "Closed",
    subject: "Refund request",
  },
  {
    id: "#4820",
    priority: "Urgent",
    agent: "Jordan Lee",
    status: "In Progress",
    subject: "Production outage report",
  },
  {
    id: "#4819",
    priority: "Medium",
    agent: "Sam Rivera",
    status: "Waiting",
    subject: "Seat upgrade quote",
  },
  {
    id: "#4818",
    priority: "Low",
    agent: "AI Agent",
    status: "Closed",
    subject: "Password reset help",
  },
  {
    id: "#4817",
    priority: "High",
    agent: "Aisha Rahman",
    status: "Open",
    subject: "Data residency question",
  },
]

export const aiSummary = {
  handledToday: 214,
  escalated: 18,
  avgResponseTime: "2.4s",
  automationCoverage: 76,
}

export const activityTimeline: ActivityItem[] = [
  {
    id: "a1",
    title: "AI resolved billing dispute",
    description: "Refund issued for Acme Corp without human handoff.",
    time: "2m ago",
    type: "ai",
  },
  {
    id: "a2",
    title: "Ticket #4820 assigned",
    description: "Jordan Lee picked up an urgent production issue.",
    time: "18m ago",
    type: "ticket",
  },
  {
    id: "a3",
    title: "Knowledge base synced",
    description: "12 help articles re-indexed for retrieval.",
    time: "45m ago",
    type: "system",
  },
  {
    id: "a4",
    title: "Team shift started",
    description: "EU support pod is now online.",
    time: "1h ago",
    type: "team",
  },
  {
    id: "a5",
    title: "CSAT survey completed",
    description: "Customer rated the AI chat 5/5.",
    time: "2h ago",
    type: "ai",
  },
]

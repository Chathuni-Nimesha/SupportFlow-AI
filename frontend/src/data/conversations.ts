export type ConversationStatus =
  | "Open"
  | "Waiting"
  | "Closed"
  | "AI Resolved"

export type ConversationFilter =
  | "inbox"
  | "open"
  | "waiting"
  | "closed"
  | "ai-resolved"

export type MessageSender = "customer" | "ai" | "agent"

export type ConversationMessage = {
  id: string
  sender: MessageSender
  content: string
  timestamp: string
}

export type Conversation = {
  id: string
  customerName: string
  customerEmail: string
  initials: string
  lastMessage: string
  unread: number
  time: string
  status: ConversationStatus
  channel: "Chat" | "Email" | "Slack"
  filterTags: ConversationFilter[]
  messages: ConversationMessage[]
  ai: {
    suggestedReply: string
    knowledgeArticle: {
      title: string
      snippet: string
    }
    sentiment: "Positive" | "Neutral" | "Negative"
    confidence: number
  }
}

export const conversationFilters: {
  id: ConversationFilter
  label: string
  count: number
}[] = [
  { id: "inbox", label: "Inbox", count: 18 },
  { id: "open", label: "Open", count: 9 },
  { id: "waiting", label: "Waiting", count: 4 },
  { id: "closed", label: "Closed", count: 32 },
  { id: "ai-resolved", label: "AI Resolved", count: 21 },
]

export const conversations: Conversation[] = [
  {
    id: "conv-1",
    customerName: "Elena Park",
    customerEmail: "elena@acmecorp.com",
    initials: "EP",
    lastMessage: "I was charged twice for March — can you refund one?",
    unread: 2,
    time: "2m",
    status: "Open",
    channel: "Chat",
    filterTags: ["inbox", "open"],
    messages: [
      {
        id: "m1",
        sender: "customer",
        content:
          "Hi — I noticed two identical charges for our March invoice. Can someone help?",
        timestamp: "10:12 AM",
      },
      {
        id: "m2",
        sender: "ai",
        content:
          "I found invoices INV-3041 and INV-3041-DUP for March 12. I can refund $49 now or credit your next invoice. Which do you prefer?",
        timestamp: "10:12 AM",
      },
      {
        id: "m3",
        sender: "customer",
        content: "I was charged twice for March — can you refund one?",
        timestamp: "10:14 AM",
      },
    ],
    ai: {
      suggestedReply:
        "Absolutely — I’ve confirmed the duplicate charge and can process a $49 refund to your original payment method within 2–3 business days. Want me to proceed?",
      knowledgeArticle: {
        title: "Handling duplicate invoice charges",
        snippet:
          "Verify invoice IDs, confirm payment processor status, then issue refund or credit memo within SLA.",
      },
      sentiment: "Neutral",
      confidence: 92,
    },
  },
  {
    id: "conv-2",
    customerName: "Marcus Webb",
    customerEmail: "marcus@orbitly.io",
    initials: "MW",
    lastMessage: "SSO still fails for two admin seats.",
    unread: 1,
    time: "14m",
    status: "Waiting",
    channel: "Email",
    filterTags: ["inbox", "waiting"],
    messages: [
      {
        id: "m1",
        sender: "customer",
        content: "Our Okta SSO setup worked yesterday, but admins can’t sign in now.",
        timestamp: "Yesterday",
      },
      {
        id: "m2",
        sender: "agent",
        content:
          "Thanks Marcus — I’ve asked our identity team to check your SAML assertion. Can you share a recent error screenshot?",
        timestamp: "Yesterday",
      },
      {
        id: "m3",
        sender: "customer",
        content: "SSO still fails for two admin seats.",
        timestamp: "9:58 AM",
      },
    ],
    ai: {
      suggestedReply:
        "Thanks for the update. I’ve escalated this to our identity specialists and we’ll validate your SAML certificate expiry next. I’ll reply within 30 minutes.",
      knowledgeArticle: {
        title: "SSO troubleshooting checklist",
        snippet:
          "Validate ACS URL, certificate rotation, and IdP clock skew before escalating to engineering.",
      },
      sentiment: "Negative",
      confidence: 78,
    },
  },
  {
    id: "conv-3",
    customerName: "Priya Nair",
    customerEmail: "priya@harborlabs.com",
    initials: "PN",
    lastMessage: "Perfect, that export worked. Thank you!",
    unread: 0,
    time: "28m",
    status: "AI Resolved",
    channel: "Chat",
    filterTags: ["inbox", "ai-resolved", "closed"],
    messages: [
      {
        id: "m1",
        sender: "customer",
        content: "How do I export analytics for last quarter?",
        timestamp: "9:30 AM",
      },
      {
        id: "m2",
        sender: "ai",
        content:
          "Go to Analytics → Reports → Date range → Export CSV. I can also email the Q1 pack to you if you’d like.",
        timestamp: "9:30 AM",
      },
      {
        id: "m3",
        sender: "customer",
        content: "Perfect, that export worked. Thank you!",
        timestamp: "9:41 AM",
      },
    ],
    ai: {
      suggestedReply:
        "Glad that worked! If you need scheduled exports, I can enable a weekly CSV to your billing email.",
      knowledgeArticle: {
        title: "Exporting analytics reports",
        snippet:
          "CSV and PDF exports are available from Analytics → Reports with custom date ranges.",
      },
      sentiment: "Positive",
      confidence: 96,
    },
  },
  {
    id: "conv-4",
    customerName: "Jonah Pierce",
    customerEmail: "jonah@clearpath.co",
    initials: "JP",
    lastMessage: "We’re hitting 429s on the messages endpoint.",
    unread: 0,
    time: "1h",
    status: "Open",
    channel: "Slack",
    filterTags: ["inbox", "open"],
    messages: [
      {
        id: "m1",
        sender: "customer",
        content: "We’re hitting 429s on the messages endpoint.",
        timestamp: "9:02 AM",
      },
      {
        id: "m2",
        sender: "ai",
        content:
          "It looks like your workspace exceeded 120 requests/minute. I can raise a temporary burst limit or help you batch requests — which is better?",
        timestamp: "9:03 AM",
      },
    ],
    ai: {
      suggestedReply:
        "I can enable a 24-hour burst allowance while you roll out request batching. Want me to apply that now?",
      knowledgeArticle: {
        title: "API rate limits",
        snippet:
          "Default is 120 rpm per workspace. Enterprise plans can request higher sustained limits.",
      },
      sentiment: "Neutral",
      confidence: 88,
    },
  },
  {
    id: "conv-5",
    customerName: "Aisha Rahman",
    customerEmail: "aisha@voltware.com",
    initials: "AR",
    lastMessage: "Please update our billing contact to finance@voltware.com",
    unread: 3,
    time: "2h",
    status: "Open",
    channel: "Email",
    filterTags: ["inbox", "open"],
    messages: [
      {
        id: "m1",
        sender: "customer",
        content: "Please update our billing contact to finance@voltware.com",
        timestamp: "8:11 AM",
      },
    ],
    ai: {
      suggestedReply:
        "I can update the billing contact to finance@voltware.com right away. For security, please confirm you’re an account admin.",
      knowledgeArticle: {
        title: "Changing billing contacts",
        snippet:
          "Account admins can update billing email from Settings → Billing → Contacts.",
      },
      sentiment: "Neutral",
      confidence: 91,
    },
  },
  {
    id: "conv-6",
    customerName: "Leo Andersen",
    customerEmail: "leo@nimbus.app",
    initials: "LA",
    lastMessage: "Closing this out — issue resolved on our side.",
    unread: 0,
    time: "Yesterday",
    status: "Closed",
    channel: "Chat",
    filterTags: ["closed"],
    messages: [
      {
        id: "m1",
        sender: "customer",
        content: "Widget wasn’t loading on Safari 16.",
        timestamp: "Yesterday",
      },
      {
        id: "m2",
        sender: "agent",
        content:
          "Thanks Leo — we shipped a Safari patch overnight. Can you hard refresh and confirm?",
        timestamp: "Yesterday",
      },
      {
        id: "m3",
        sender: "customer",
        content: "Closing this out — issue resolved on our side.",
        timestamp: "Yesterday",
      },
    ],
    ai: {
      suggestedReply:
        "Appreciate the confirmation. I’ll mark this closed. Reach out anytime if Safari acts up again.",
      knowledgeArticle: {
        title: "Chat widget browser support",
        snippet:
          "Supported on latest Chrome, Firefox, Edge, and Safari 16+. Clear cache after releases.",
      },
      sentiment: "Positive",
      confidence: 94,
    },
  },
  {
    id: "conv-7",
    customerName: "Sofia Mendes",
    customerEmail: "sofia@lumenlabs.io",
    initials: "SM",
    lastMessage: "Can AI summarize our last 10 tickets?",
    unread: 0,
    time: "Yesterday",
    status: "AI Resolved",
    channel: "Chat",
    filterTags: ["ai-resolved", "closed"],
    messages: [
      {
        id: "m1",
        sender: "customer",
        content: "Can AI summarize our last 10 tickets?",
        timestamp: "Yesterday",
      },
      {
        id: "m2",
        sender: "ai",
        content:
          "Here’s a concise summary: 6 billing clarifications, 3 integration setup questions, and 1 urgent outage (resolved). Want a PDF?",
        timestamp: "Yesterday",
      },
    ],
    ai: {
      suggestedReply:
        "I can email a PDF summary to sofia@lumenlabs.io and pin it in your workspace. Shall I send it?",
      knowledgeArticle: {
        title: "AI ticket summaries",
        snippet:
          "Summaries pull from closed tickets in the selected date range and respect workspace permissions.",
      },
      sentiment: "Positive",
      confidence: 89,
    },
  },
  {
    id: "conv-8",
    customerName: "Chris Nolan",
    customerEmail: "chris@harbor.co",
    initials: "CN",
    lastMessage: "Still waiting on the data residency answer.",
    unread: 1,
    time: "2d",
    status: "Waiting",
    channel: "Email",
    filterTags: ["inbox", "waiting"],
    messages: [
      {
        id: "m1",
        sender: "customer",
        content: "Do you offer EU-only data residency for Enterprise?",
        timestamp: "2 days ago",
      },
      {
        id: "m2",
        sender: "agent",
        content:
          "Yes — EU residency is available on Enterprise. I’m confirming capacity for your region and will follow up today.",
        timestamp: "2 days ago",
      },
      {
        id: "m3",
        sender: "customer",
        content: "Still waiting on the data residency answer.",
        timestamp: "Today",
      },
    ],
    ai: {
      suggestedReply:
        "Thanks for your patience. EU residency is available for your plan, with Frankfurt as the primary region. I can schedule a 20-minute setup call this week.",
      knowledgeArticle: {
        title: "Enterprise data residency",
        snippet:
          "EU and US residency options are available on Enterprise with dedicated collection routing.",
      },
      sentiment: "Negative",
      confidence: 85,
    },
  },
]

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

export type ConversationChannel = "Chat" | "Email" | "Slack"

export type MessageSender = "customer" | "ai" | "agent"

/** Raw API conversation payload */
export type ConversationApi = {
  id: string
  owner_id: string
  workspace_id?: string
  customer_id?: string | null
  customer_name: string
  customer_email: string
  subject: string
  status: ConversationStatus
  channel: ConversationChannel
  assigned_agent_id: string | null
  unread_count: number
  last_message: string
  created_at: string
  updated_at: string
}

/** Raw API message payload */
export type ConversationMessageApi = {
  id: string
  conversation_id: string
  sender_type: MessageSender
  sender_name: string | null
  content: string
  created_at: string
}

export type ConversationMessage = {
  id: string
  sender: MessageSender
  content: string
  timestamp: string
  createdAt: string
}

/** Raw API payload from POST /conversations/{id}/ai/suggest */
export type ConversationAiSourceApi = {
  document_id: string | null
  title: string | null
  source: string | null
  chunk_id: string | null
  score: number | null
  distance: number | null
  metadata?: Record<string, unknown>
}

export type ConversationAiSuggestApi = {
  conversation_id: string
  suggested_reply: string
  sources: ConversationAiSourceApi[]
  retrieved_count: number
  used_generation: boolean
  customer_message_id: string | null
}

export type ConversationAiSource = {
  documentId: string | null
  title: string | null
  source: string | null
  chunkId: string | null
  score: number | null
  distance: number | null
}

/** Mapped AI suggestion used by the Conversations AI panel */
export type ConversationAiSuggestion = {
  conversationId: string
  suggestedReply: string
  sources: ConversationAiSource[]
  retrievedCount: number
  usedGeneration: boolean
  customerMessageId: string | null
}

export type ConversationAiSuggestRequest = {
  top_k?: number
}

/** View-model used by existing Conversations UI components */
export type Conversation = {
  id: string
  customerId?: string | null
  customerName: string
  customerEmail: string
  initials: string
  subject: string
  lastMessage: string
  unread: number
  time: string
  status: ConversationStatus
  channel: ConversationChannel
  updatedAt: string
  filterTags: ConversationFilter[]
  messages: ConversationMessage[]
}

export type ConversationCreatePayload = {
  customer_name: string
  customer_email: string
  subject: string
  channel?: ConversationChannel
  status?: ConversationStatus
  unread_count?: number
  initial_message?: string
  customer_id?: string | null
}

export type ConversationUpdatePayload = {
  subject?: string
  status?: ConversationStatus
  channel?: ConversationChannel
  assigned_agent_id?: string | null
  unread_count?: number
  customer_name?: string
  customer_email?: string
  customer_id?: string | null
}

export type ConversationMessageCreatePayload = {
  content: string
  sender_type?: MessageSender
  sender_name?: string | null
}

import type { ConversationFilter } from "@/types/conversations"

export type {
  Conversation,
  ConversationFilter,
  ConversationMessage,
  ConversationStatus,
  MessageSender,
} from "@/types/conversations"

/** Filter labels for the inbox sidebar (counts are computed at runtime). */
export const conversationFilterDefs: {
  id: ConversationFilter
  label: string
}[] = [
  { id: "inbox", label: "Inbox" },
  { id: "open", label: "Open" },
  { id: "waiting", label: "Waiting" },
  { id: "closed", label: "Closed" },
  { id: "ai-resolved", label: "AI Resolved" },
]

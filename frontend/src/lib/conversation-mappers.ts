import type {
  Conversation,
  ConversationApi,
  ConversationFilter,
  ConversationMessage,
  ConversationMessageApi,
  ConversationStatus,
} from "@/types/conversations"

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

export function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""

  const diffMs = Date.now() - date.getTime()
  const diffSec = Math.round(diffMs / 1000)
  if (diffSec < 60) return "Just now"
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h`
  const diffDay = Math.round(diffHr / 24)
  if (diffDay < 7) return `${diffDay}d`

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })
}

export function formatMessageTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""

  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })
}

export function statusToFilterTags(
  status: ConversationStatus,
): ConversationFilter[] {
  const tags: ConversationFilter[] = ["inbox"]
  switch (status) {
    case "Open":
      tags.push("open")
      break
    case "Waiting":
      tags.push("waiting")
      break
    case "Closed":
      tags.push("closed")
      break
    case "AI Resolved":
      tags.push("ai-resolved")
      break
  }
  return tags
}

export function mapMessageFromApi(
  message: ConversationMessageApi,
): ConversationMessage {
  return {
    id: message.id,
    sender: message.sender_type,
    content: message.content,
    timestamp: formatMessageTimestamp(message.created_at),
    createdAt: message.created_at,
  }
}

export function mapConversationFromApi(
  conversation: ConversationApi,
  messages: ConversationMessage[] = [],
): Conversation {
  return {
    id: conversation.id,
    customerId: conversation.customer_id?.trim() || null,
    customerName: conversation.customer_name,
    customerEmail: conversation.customer_email,
    initials: initialsFromName(conversation.customer_name),
    subject: conversation.subject,
    lastMessage: conversation.last_message,
    unread: conversation.unread_count,
    time: formatRelativeTime(conversation.updated_at),
    status: conversation.status,
    channel: conversation.channel,
    updatedAt: conversation.updated_at,
    filterTags: statusToFilterTags(conversation.status),
    messages,
    assignedAgentId: conversation.assigned_agent_id?.trim() || null,
  }
}

export function mergeConversationUpdate(
  current: Conversation,
  api: ConversationApi,
): Conversation {
  return {
    ...current,
    ...mapConversationFromApi(api, current.messages),
  }
}

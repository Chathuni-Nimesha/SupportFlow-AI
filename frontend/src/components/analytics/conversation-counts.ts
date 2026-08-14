import type {
  ConversationApi,
  ConversationChannel,
  ConversationStatus,
} from "@/types/conversations"

export type ConversationStatusCounts = {
  total: number
  Open: number
  Waiting: number
  Closed: number
  "AI Resolved": number
}

export type ChannelCount = {
  channel: ConversationChannel
  count: number
}

const CHANNEL_ORDER: ConversationChannel[] = ["Chat", "Email", "Slack"]

export function countByStatus(
  conversations: ConversationApi[],
): ConversationStatusCounts {
  const counts: ConversationStatusCounts = {
    total: conversations.length,
    Open: 0,
    Waiting: 0,
    Closed: 0,
    "AI Resolved": 0,
  }

  for (const conversation of conversations) {
    const status: ConversationStatus = conversation.status
    counts[status] += 1
  }

  return counts
}

export function countPresentChannels(
  conversations: ConversationApi[],
): ChannelCount[] {
  const counts = new Map<ConversationChannel, number>()

  for (const conversation of conversations) {
    counts.set(conversation.channel, (counts.get(conversation.channel) ?? 0) + 1)
  }

  return CHANNEL_ORDER.flatMap((channel) => {
    const count = counts.get(channel)
    return count ? [{ channel, count }] : []
  })
}

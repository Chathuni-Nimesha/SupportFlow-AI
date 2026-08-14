import { api } from "@/services/api"
import type {
  ConversationAiSource,
  ConversationAiSuggestApi,
  ConversationAiSuggestRequest,
  ConversationAiSuggestion,
} from "@/types/conversations"

function mapSource(
  source: ConversationAiSuggestApi["sources"][number],
): ConversationAiSource {
  return {
    documentId: source.document_id,
    title: source.title,
    source: source.source,
    chunkId: source.chunk_id,
    score: source.score,
    distance: source.distance,
  }
}

export function mapConversationAiSuggestion(
  payload: ConversationAiSuggestApi,
): ConversationAiSuggestion {
  return {
    conversationId: payload.conversation_id,
    suggestedReply: payload.suggested_reply,
    sources: (payload.sources ?? []).map(mapSource),
    retrievedCount: payload.retrieved_count,
    usedGeneration: payload.used_generation,
    customerMessageId: payload.customer_message_id,
  }
}

export async function suggestConversationReply(
  conversationId: string,
  topK = 5,
): Promise<ConversationAiSuggestion> {
  const body: ConversationAiSuggestRequest = { top_k: topK }
  const { data } = await api.post<ConversationAiSuggestApi>(
    `/conversations/${conversationId}/ai/suggest`,
    body,
  )
  return mapConversationAiSuggestion(data)
}

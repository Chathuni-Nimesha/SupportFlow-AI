import type { AiAnswer } from "@/types/ai"
import type { AuthTokenResponse, AuthUser } from "@/types/auth"
import type {
  Conversation,
  ConversationApi,
  ConversationMessage,
  ConversationMessageApi,
} from "@/types/conversations"
import type {
  KnowledgeDocument,
  KnowledgeSearchHit,
  KnowledgeSearchResponse,
} from "@/types/knowledge"

export const sampleUser: AuthUser = {
  id: "user-1",
  first_name: "Ava",
  last_name: "Chen",
  company_name: "Acme Support",
  email: "ava@acme.example",
  is_active: true,
  created_at: "2026-01-15T10:00:00.000Z",
}

export const sampleAuthToken: AuthTokenResponse = {
  access_token: "test-token",
  token_type: "bearer",
  user: sampleUser,
}

export function makeConversationApi(
  overrides: Partial<ConversationApi> = {},
): ConversationApi {
  return {
    id: "conv-1",
    owner_id: "user-1",
    customer_name: "Elena Park",
    customer_email: "elena@acme.example",
    subject: "Refund request",
    status: "Open",
    channel: "Email",
    assigned_agent_id: null,
    unread_count: 0,
    last_message: "Can I request a refund?",
    created_at: "2026-08-20T12:00:00.000Z",
    updated_at: "2026-08-20T12:00:00.000Z",
    ...overrides,
  }
}

export function makeMessageApi(
  overrides: Partial<ConversationMessageApi> = {},
): ConversationMessageApi {
  return {
    id: "msg-1",
    conversation_id: "conv-1",
    sender_type: "customer",
    sender_name: "Elena Park",
    content: "Can I request a refund?",
    created_at: "2026-08-20T12:00:00.000Z",
    ...overrides,
  }
}

export function makeConversation(
  overrides: Partial<Conversation> = {},
): Conversation {
  return {
    id: "conv-1",
    customerName: "Elena Park",
    customerEmail: "elena@acme.example",
    initials: "EP",
    subject: "Refund request",
    lastMessage: "Can I request a refund?",
    unread: 0,
    time: "2h",
    status: "Open",
    channel: "Email",
    updatedAt: "2026-08-20T12:00:00.000Z",
    filterTags: ["inbox", "open"],
    messages: [],
    ...overrides,
  }
}

export function makeUiMessage(
  overrides: Partial<ConversationMessage> = {},
): ConversationMessage {
  return {
    id: "msg-1",
    sender: "customer",
    content: "Can I request a refund?",
    timestamp: "12:00 PM",
    createdAt: "2026-08-20T12:00:00.000Z",
    ...overrides,
  }
}

export function makeKnowledgeDocument(
  overrides: Partial<KnowledgeDocument> = {},
): KnowledgeDocument {
  return {
    id: "doc-1",
    owner_id: "user-1",
    title: "Refund policy",
    content: "Customers may request a refund within 14 days of purchase.",
    source_type: "manual",
    source: null,
    status: "Published",
    tags: ["billing"],
    ingestion_status: "indexed",
    ingestion_error: null,
    ingested_at: "2026-08-20T12:00:00.000Z",
    chunk_count: 1,
    created_at: "2026-08-20T12:00:00.000Z",
    updated_at: "2026-08-20T12:00:00.000Z",
    ...overrides,
  }
}

export function makeSearchHit(
  overrides: Partial<KnowledgeSearchHit> = {},
): KnowledgeSearchHit {
  return {
    id: "chunk-1",
    document: "Customers may request a refund within 14 days of purchase.",
    metadata: {
      document_id: "doc-1",
      title: "Refund policy",
      source: "handbook",
      source_type: "manual",
      chunk_index: 0,
      chunk_count: 1,
    },
    distance: 0.12,
    score: 0.88,
    ...overrides,
  }
}

export function makeSearchResponse(
  overrides: Partial<KnowledgeSearchResponse> = {},
): KnowledgeSearchResponse {
  const results = overrides.results ?? [makeSearchHit()]
  return {
    query: "refund policy",
    top_k: 5,
    count: results.length,
    results,
    ...overrides,
  }
}

export const sampleGroundedAnswer: AiAnswer = {
  answer: "Customers may request a refund within 14 days of purchase.",
  sources: [
    {
      documentId: "doc-1",
      title: "Refund policy",
      source: "handbook",
      chunkId: "chunk-1",
      score: 0.91,
      distance: 0.09,
    },
  ],
  retrievedCount: 1,
  usedGeneration: true,
}

export const sampleNoKnowledgeAnswer: AiAnswer = {
  answer: "There is not enough published knowledge to answer this question.",
  sources: [],
  retrievedCount: 0,
  usedGeneration: false,
}

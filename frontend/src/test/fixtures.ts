import type { AiAnswer } from "@/types/ai"
import type { Customer, CustomerDetail } from "@/types/customers"
import type { TeamMember } from "@/types/team"
import type { Ticket } from "@/types/tickets"
import type { AuthTokenResponse, AuthUser, AuthWorkspaceSummary } from "@/types/auth"
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
  default_workspace_id: "workspace-1",
  workspaces: [
    { id: "workspace-1", name: "Acme Support", role: "OWNER" },
  ],
}

export function makeAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    ...sampleUser,
    workspaces: sampleUser.workspaces ? [...sampleUser.workspaces] : [],
    ...overrides,
  }
}

export function makeWorkspaceSummary(
  overrides: Partial<AuthWorkspaceSummary> = {},
): AuthWorkspaceSummary {
  return {
    id: "workspace-1",
    name: "Acme Support",
    role: "OWNER",
    ...overrides,
  }
}

export function makeAdminUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return makeAuthUser({
    id: "user-admin",
    first_name: "Maya",
    last_name: "Admin",
    email: "maya@acme.example",
    workspaces: [makeWorkspaceSummary({ role: "ADMIN" })],
    ...overrides,
  })
}

export function makeAgentUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return makeAuthUser({
    id: "user-agent",
    first_name: "Sam",
    last_name: "Agent",
    email: "sam@acme.example",
    workspaces: [makeWorkspaceSummary({ role: "AGENT" })],
    ...overrides,
  })
}

export function makeMultiWorkspaceUser(
  active: "A" | "B" = "A",
  overrides: Partial<AuthUser> = {},
): AuthUser {
  return makeAuthUser({
    default_workspace_id: active === "B" ? "workspace-b" : "workspace-a",
    workspaces: [
      makeWorkspaceSummary({
        id: "workspace-a",
        name: "Workspace A",
        role: "ADMIN",
      }),
      makeWorkspaceSummary({
        id: "workspace-b",
        name: "Workspace B",
        role: "AGENT",
      }),
    ],
    ...overrides,
  })
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
    workspace_id: "workspace-1",
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

export function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "cust-1",
    owner_id: "user-1",
    workspace_id: "workspace-1",
    first_name: "Elena",
    last_name: "Park",
    email: "elena@acme.example",
    phone: "+1-555-0100",
    company: "Harbor Retail",
    notes: "Prefers email follow-up.",
    created_at: "2026-08-20T12:00:00.000Z",
    updated_at: "2026-08-20T12:00:00.000Z",
    ...overrides,
  }
}

export function makeCustomerDetail(
  overrides: Partial<CustomerDetail> = {},
): CustomerDetail {
  const { conversations, ...customerOverrides } = overrides
  return {
    ...makeCustomer(customerOverrides),
    conversations: conversations ?? [],
  }
}

export function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "tkt-1",
    owner_id: "user-1",
    workspace_id: "workspace-1",
    customer_id: "cust-1",
    conversation_id: null,
    title: "Refund not received",
    description: "Customer paid twice and needs the duplicate charge reversed.",
    status: "OPEN",
    priority: "HIGH",
    assignee_id: null,
    created_at: "2026-08-20T12:00:00.000Z",
    updated_at: "2026-08-20T12:00:00.000Z",
    customer: {
      id: "cust-1",
      first_name: "Elena",
      last_name: "Park",
      email: "elena@acme.example",
    },
    assignee: null,
    ...overrides,
  }
}

export function makeTeamMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    id: "member-1",
    owner_id: "user-1",
    workspace_id: "workspace-1",
    user_id: null,
    first_name: "Sarah",
    last_name: "Perera",
    email: "sarah@acme.example",
    role: "AGENT",
    status: "ACTIVE",
    created_at: "2026-08-20T12:00:00.000Z",
    updated_at: "2026-08-20T12:00:00.000Z",
    ...overrides,
  }
}

export function makeOwnerMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return makeTeamMember({
    id: "user-1",
    user_id: "user-1",
    first_name: "Ava",
    last_name: "Chen",
    email: "ava@acme.example",
    role: "OWNER",
    ...overrides,
  })
}

export function makeKnowledgeDocument(
  overrides: Partial<KnowledgeDocument> = {},
): KnowledgeDocument {
  return {
    id: "doc-1",
    owner_id: "user-1",
    workspace_id: "workspace-1",
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

export function asPage<T>(
  items: T[],
  overrides: Partial<{
    page: number
    pageSize: number
    total: number
    hasNext: boolean
  }> = {},
) {
  return {
    items,
    page: overrides.page ?? 1,
    pageSize: overrides.pageSize ?? 20,
    total: overrides.total ?? items.length,
    hasNext: overrides.hasNext ?? false,
  }
}

export const sampleNoKnowledgeAnswer: AiAnswer = {
  answer: "There is not enough published knowledge to answer this question.",
  sources: [],
  retrievedCount: 0,
  usedGeneration: false,
}

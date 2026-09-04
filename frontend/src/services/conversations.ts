import { api } from "@/services/api"
import {
  DEFAULT_PAGE_SIZE,
  mapPaginated,
  type ListPaginationParams,
  type PaginatedApi,
  type PaginatedList,
} from "@/types/pagination"
import type {
  ConversationApi,
  ConversationCreatePayload,
  ConversationMessageApi,
  ConversationMessageCreatePayload,
  ConversationUpdatePayload,
} from "@/types/conversations"

export async function listConversations(
  params: ListPaginationParams = {},
): Promise<PaginatedList<ConversationApi>> {
  const { data } = await api.get<PaginatedApi<ConversationApi>>(
    "/conversations",
    {
      params: {
        page: params.page ?? 1,
        page_size: params.pageSize ?? DEFAULT_PAGE_SIZE,
      },
    },
  )
  return mapPaginated(data)
}

export async function getConversation(
  conversationId: string,
): Promise<ConversationApi> {
  const { data } = await api.get<ConversationApi>(
    `/conversations/${conversationId}`,
  )
  return data
}

export async function createConversation(
  payload: ConversationCreatePayload,
): Promise<ConversationApi> {
  const { data } = await api.post<ConversationApi>("/conversations", payload)
  return data
}

export async function updateConversation(
  conversationId: string,
  payload: ConversationUpdatePayload,
): Promise<ConversationApi> {
  const { data } = await api.patch<ConversationApi>(
    `/conversations/${conversationId}`,
    payload,
  )
  return data
}

export async function listConversationMessages(
  conversationId: string,
): Promise<ConversationMessageApi[]> {
  const { data } = await api.get<ConversationMessageApi[]>(
    `/conversations/${conversationId}/messages`,
  )
  return data
}

export async function sendConversationMessage(
  conversationId: string,
  payload: ConversationMessageCreatePayload,
): Promise<ConversationMessageApi> {
  const { data } = await api.post<ConversationMessageApi>(
    `/conversations/${conversationId}/messages`,
    payload,
  )
  return data
}

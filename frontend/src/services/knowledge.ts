import { api } from "@/services/api"
import type {
  KnowledgeDocument,
  KnowledgeDocumentCreatePayload,
  KnowledgeDocumentUpdatePayload,
  KnowledgeIngestionResponse,
  KnowledgeSearchRequest,
  KnowledgeSearchResponse,
} from "@/types/knowledge"

export async function listKnowledgeDocuments(): Promise<KnowledgeDocument[]> {
  const { data } = await api.get<KnowledgeDocument[]>("/knowledge-documents")
  return data
}

export async function getKnowledgeDocument(
  documentId: string,
): Promise<KnowledgeDocument> {
  const { data } = await api.get<KnowledgeDocument>(
    `/knowledge-documents/${documentId}`,
  )
  return data
}

export async function createKnowledgeDocument(
  payload: KnowledgeDocumentCreatePayload,
): Promise<KnowledgeDocument> {
  const { data } = await api.post<KnowledgeDocument>(
    "/knowledge-documents",
    payload,
  )
  return data
}

export async function updateKnowledgeDocument(
  documentId: string,
  payload: KnowledgeDocumentUpdatePayload,
): Promise<KnowledgeDocument> {
  const { data } = await api.patch<KnowledgeDocument>(
    `/knowledge-documents/${documentId}`,
    payload,
  )
  return data
}

export async function deleteKnowledgeDocument(
  documentId: string,
): Promise<void> {
  await api.delete(`/knowledge-documents/${documentId}`)
}

export async function ingestKnowledgeDocument(
  documentId: string,
): Promise<KnowledgeIngestionResponse> {
  const { data } = await api.post<KnowledgeIngestionResponse>(
    `/knowledge-documents/${documentId}/ingest`,
  )
  return data
}

export async function searchKnowledge(
  payload: KnowledgeSearchRequest,
): Promise<KnowledgeSearchResponse> {
  const { data } = await api.post<KnowledgeSearchResponse>(
    "/knowledge/search",
    payload,
  )
  return data
}

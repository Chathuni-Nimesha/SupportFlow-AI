export type KnowledgeStatus = "Draft" | "Published"
export type KnowledgeSourceType = "manual" | "url" | "file"
export type KnowledgeIngestionStatus =
  | "pending"
  | "indexed"
  | "failed"
  | "not_indexed"

/** Raw API knowledge document payload */
export type KnowledgeDocument = {
  id: string
  owner_id: string
  workspace_id?: string
  title: string
  content: string
  source_type: KnowledgeSourceType
  source: string | null
  status: KnowledgeStatus
  tags: string[]
  ingestion_status: KnowledgeIngestionStatus
  ingestion_error: string | null
  ingested_at: string | null
  chunk_count: number
  created_at: string
  updated_at: string
}

/** POST /knowledge-documents/{id}/ingest */
export type KnowledgeIngestionResponse = {
  document: KnowledgeDocument
  ingestion_status: KnowledgeIngestionStatus
  chunk_count: number
  message: string
}

export type KnowledgeDocumentCreatePayload = {
  title: string
  content: string
  source_type?: KnowledgeSourceType
  source?: string | null
  status?: KnowledgeStatus
  tags?: string[]
}

export type KnowledgeDocumentUpdatePayload = {
  title?: string
  content?: string
  source_type?: KnowledgeSourceType
  source?: string | null
  status?: KnowledgeStatus
  tags?: string[]
}

export type KnowledgeDocumentFormValues = {
  title: string
  content: string
  source_type: KnowledgeSourceType
  source: string
  status: KnowledgeStatus
  tags: string
}

/** POST /knowledge/search */
export type KnowledgeSearchRequest = {
  query: string
  top_k?: number
}

/** Raw API hit from POST /knowledge/search */
export type KnowledgeSearchHit = {
  id: string
  document: string
  metadata: Record<string, unknown>
  distance: number | null
  score: number | null
}

export type KnowledgeSearchResponse = {
  query: string
  top_k: number
  count: number
  results: KnowledgeSearchHit[]
}

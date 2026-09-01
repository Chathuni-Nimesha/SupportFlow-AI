import type {
  KnowledgeDocument,
  KnowledgeDocumentCreatePayload,
  KnowledgeDocumentFormValues,
  KnowledgeDocumentUpdatePayload,
  KnowledgeIngestionStatus,
  KnowledgeStatus,
} from "@/types/knowledge"

export function formatKnowledgeDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function parseTagsInput(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
}

export function formValuesFromDocument(
  document: KnowledgeDocument,
): KnowledgeDocumentFormValues {
  return {
    title: document.title,
    content: document.content,
    source_type: document.source_type,
    source: document.source ?? "",
    status: document.status,
    tags: document.tags.join(", "),
  }
}

export function emptyKnowledgeFormValues(): KnowledgeDocumentFormValues {
  return {
    title: "",
    content: "",
    source_type: "manual",
    source: "",
    status: "Draft",
    tags: "",
  }
}

export function toCreatePayload(
  values: KnowledgeDocumentFormValues,
): KnowledgeDocumentCreatePayload {
  return {
    title: values.title.trim(),
    content: values.content.trim(),
    source_type: values.source_type,
    source: values.source.trim() || null,
    status: values.status,
    tags: parseTagsInput(values.tags),
  }
}

export function toUpdatePayload(
  values: KnowledgeDocumentFormValues,
): KnowledgeDocumentUpdatePayload {
  return toCreatePayload(values)
}

const INGESTION_STATUS_LABELS: Record<KnowledgeIngestionStatus, string> = {
  indexed: "Indexed",
  pending: "Pending",
  failed: "Failed",
  not_indexed: "Not indexed",
}

export function formatIngestionStatus(
  status: KnowledgeIngestionStatus,
): string {
  return INGESTION_STATUS_LABELS[status] ?? status
}

export function formatChunkCount(count: number): string {
  return `${count} ${count === 1 ? "chunk" : "chunks"}`
}

export function knowledgeAiAvailabilityMessage(
  status: KnowledgeStatus,
): string {
  if (status === "Draft") {
    return "Draft documents are not available to the AI assistant."
  }
  return "Published — available to AI when indexed"
}

export function knowledgeIngestionErrorMessage(
  error: string | null,
): string {
  const trimmed = error?.trim()
  if (trimmed) return trimmed
  return "This document could not be indexed. Try Re-ingest to retry."
}

export function matchesKnowledgeSearch(
  document: KnowledgeDocument,
  query: string,
): boolean {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true

  return (
    document.title.toLowerCase().includes(normalized) ||
    document.content.toLowerCase().includes(normalized) ||
    document.tags.some((tag) => tag.toLowerCase().includes(normalized)) ||
    (document.source ?? "").toLowerCase().includes(normalized) ||
    document.source_type.toLowerCase().includes(normalized)
  )
}

export function knowledgeHitMetaString(
  metadata: Record<string, unknown>,
  key: string,
): string | null {
  const value = metadata[key]
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

export function knowledgeHitMetaNumber(
  metadata: Record<string, unknown>,
  key: string,
): number | null {
  const value = metadata[key]
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

export function formatKnowledgeScore(score: number | null): string | null {
  if (score === null || Number.isNaN(score)) return null
  return `${Math.round(score * 100)}% match`
}

export function formatKnowledgeChunkLabel(
  chunkIndex: number | null,
  chunkCount: number | null,
): string | null {
  if (chunkIndex === null) return null
  const humanIndex = chunkIndex + 1
  if (chunkCount !== null && chunkCount > 0) {
    return `Chunk ${humanIndex} of ${chunkCount}`
  }
  return `Chunk ${humanIndex}`
}

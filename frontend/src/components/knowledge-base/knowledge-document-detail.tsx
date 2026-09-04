import { Loader2 } from "lucide-react"

import {
  KnowledgeAiAvailabilityNotice,
  KnowledgeStatusBadge,
} from "@/components/knowledge-base/knowledge-document-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  formatChunkCount,
  formatIngestionStatus,
  formatKnowledgeDate,
  knowledgeIngestionErrorMessage,
} from "@/lib/knowledge-mappers"
import type { KnowledgeDocument } from "@/types/knowledge"

type KnowledgeDocumentDetailProps = {
  document: KnowledgeDocument
  onEdit: () => void
  onClose: () => void
  onIngest: () => void
  isIngesting?: boolean
  ingestError?: string | null
  canManage?: boolean
}

export function KnowledgeDocumentDetail({
  document,
  onEdit,
  onClose,
  onIngest,
  isIngesting = false,
  ingestError = null,
  canManage = true,
}: KnowledgeDocumentDetailProps) {
  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1">
        <div className="space-y-5 px-4 py-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {document.title}
              </h2>
              <KnowledgeStatusBadge status={document.status} />
            </div>
            <p className="text-xs text-muted-foreground">
              {document.source_type}
              {document.source ? ` · ${document.source}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              Updated {formatKnowledgeDate(document.updated_at)}
            </p>
          </div>

          <div className="space-y-3 rounded-2xl border border-border/80 bg-background p-4 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  {formatIngestionStatus(document.ingestion_status)}
                </p>
                {document.chunk_count > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {formatChunkCount(document.chunk_count)}
                  </p>
                ) : null}
                {document.ingested_at ? (
                  <p className="text-xs text-muted-foreground">
                    Indexed {formatKnowledgeDate(document.ingested_at)}
                  </p>
                ) : null}
              </div>
              {canManage ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={onIngest}
                  disabled={isIngesting}
                >
                  {isIngesting ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : null}
                  {isIngesting ? "Re-ingesting…" : "Re-ingest"}
                </Button>
              ) : null}
            </div>

            <KnowledgeAiAvailabilityNotice status={document.status} />

            {document.ingestion_status === "failed" ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                {knowledgeIngestionErrorMessage(document.ingestion_error)}
              </p>
            ) : null}

            {ingestError ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                {ingestError}
              </p>
            ) : null}
          </div>

          {document.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {document.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="rounded-full">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}

          <div className="rounded-2xl border border-border/80 bg-background p-4 shadow-soft">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {document.content}
            </p>
          </div>
        </div>
      </ScrollArea>

      <div className="flex items-center justify-end gap-2 border-t border-border/70 px-4 py-3">
        <Button
          type="button"
          variant="outline"
          className="rounded-2xl"
          onClick={onClose}
          disabled={isIngesting}
        >
          Close
        </Button>
        {canManage ? (
          <Button
            type="button"
            className="rounded-2xl"
            onClick={onEdit}
            disabled={isIngesting}
          >
            Edit
          </Button>
        ) : null}
      </div>
    </div>
  )
}

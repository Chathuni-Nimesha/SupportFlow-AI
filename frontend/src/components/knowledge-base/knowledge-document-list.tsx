import { Eye, Loader2, Pencil, Trash2 } from "lucide-react"

import {
  KnowledgeAiAvailabilityNotice,
  KnowledgeIngestionBadge,
  KnowledgeStatusBadge,
} from "@/components/knowledge-base/knowledge-document-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  formatChunkCount,
  formatKnowledgeDate,
  knowledgeIngestionErrorMessage,
} from "@/lib/knowledge-mappers"
import type { KnowledgeDocument } from "@/types/knowledge"
import { cn } from "@/lib/utils"

type KnowledgeDocumentListProps = {
  documents: KnowledgeDocument[]
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  onView: (document: KnowledgeDocument) => void
  onEdit: (document: KnowledgeDocument) => void
  onDelete: (document: KnowledgeDocument) => void
  deletingId?: string | null
  canManage?: boolean
}

export function KnowledgeDocumentList({
  documents,
  isLoading = false,
  error = null,
  onRetry,
  onView,
  onEdit,
  onDelete,
  deletingId = null,
  canManage = true,
}: KnowledgeDocumentListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border/80 bg-card px-4 py-20 text-muted-foreground shadow-soft">
        <Loader2 className="size-5 animate-spin" />
        <p className="text-sm">Loading knowledge documents…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-10 text-center shadow-soft dark:border-rose-500/30 dark:bg-rose-500/10">
        <p className="text-sm font-medium text-rose-800 dark:text-rose-200">
          Couldn’t load knowledge documents
        </p>
        <p className="mt-1 text-xs text-rose-700/80 dark:text-rose-200/80">
          {error}
        </p>
        {onRetry ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4 rounded-xl"
            onClick={onRetry}
          >
            Retry
          </Button>
        ) : null}
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-16 text-center shadow-soft">
        <p className="text-sm font-semibold text-foreground">
          No knowledge documents yet
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Create your first document to power future AI answers.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {documents.map((document) => {
        const isDeleting = deletingId === document.id
        return (
          <article
            key={document.id}
            className={cn(
              "rounded-2xl border border-border/80 bg-card p-4 shadow-soft transition-colors",
              isDeleting && "opacity-60",
            )}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-sm font-semibold text-foreground sm:text-base">
                    {document.title}
                  </h2>
                  <KnowledgeStatusBadge status={document.status} />
                  <KnowledgeIngestionBadge
                    status={document.ingestion_status}
                  />
                </div>
                <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {document.content}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="rounded-full bg-muted px-2 py-0.5 font-medium capitalize">
                    {document.source_type}
                  </span>
                  {document.source ? (
                    <span className="truncate">{document.source}</span>
                  ) : null}
                  <span>·</span>
                  <span>Updated {formatKnowledgeDate(document.updated_at)}</span>
                  {document.chunk_count > 0 ? (
                    <>
                      <span>·</span>
                      <span>{formatChunkCount(document.chunk_count)}</span>
                    </>
                  ) : null}
                </div>
                <KnowledgeAiAvailabilityNotice status={document.status} />
                {document.ingestion_status === "failed" ? (
                  <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                    {knowledgeIngestionErrorMessage(document.ingestion_error)}
                  </p>
                ) : null}
                {document.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {document.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="rounded-full"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => onView(document)}
                  disabled={isDeleting}
                >
                  <Eye className="size-3.5" />
                  View
                </Button>
                {canManage ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => onEdit(document)}
                      disabled={isDeleting}
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
                      onClick={() => onDelete(document)}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                      Delete
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

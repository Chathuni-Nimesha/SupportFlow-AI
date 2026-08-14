import { BookOpen } from "lucide-react"

import type { AiAnswerSource } from "@/types/ai"

function formatScore(score: number | null): string | null {
  if (score === null || Number.isNaN(score)) return null
  return `${Math.round(score * 100)}% match`
}

type AiSourcesListProps = {
  sources: AiAnswerSource[]
}

export function AiSourcesList({ sources }: AiSourcesListProps) {
  if (sources.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No source documents returned.</p>
    )
  }

  return (
    <ul className="space-y-3">
      {sources.map((source, index) => {
        const scoreLabel = formatScore(source.score)
        return (
          <li
            key={source.chunkId ?? source.documentId ?? `source-${index}`}
            className="rounded-xl border border-border/60 bg-card/40 px-3 py-2.5"
          >
            <div className="flex items-start gap-2">
              <BookOpen
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {source.title?.trim() || "Untitled document"}
                </p>
                {source.source?.trim() ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {source.source}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Source not provided
                  </p>
                )}
                {scoreLabel ? (
                  <p className="mt-1 text-[11px] font-medium text-primary">
                    {scoreLabel}
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Score not available
                  </p>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

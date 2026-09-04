import { useEffect, useState } from "react"
import { Loader2, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  formatKnowledgeChunkLabel,
  formatKnowledgeScore,
  knowledgeHitMetaNumber,
  knowledgeHitMetaString,
} from "@/lib/knowledge-mappers"
import { searchKnowledge } from "@/services/knowledge"
import type { KnowledgeSearchHit, KnowledgeSearchResponse } from "@/types/knowledge"
import { getApiErrorMessage } from "@/utils/api-error"
import { useAuth } from "@/context/auth-provider"

const DEFAULT_TOP_K = 5
const QUERY_MAX_LENGTH = 2000

type SearchStatus = "idle" | "loading" | "success" | "error"

export function KnowledgeSemanticSearch() {
  const { currentWorkspace } = useAuth()
  const workspaceId = currentWorkspace?.id ?? null
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<SearchStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<KnowledgeSearchResponse | null>(null)
  const [lastQuery, setLastQuery] = useState("")

  useEffect(() => {
    setQuery("")
    setStatus("idle")
    setError(null)
    setResult(null)
    setLastQuery("")
  }, [workspaceId])

  const runSearch = async (value: string) => {
    const cleaned = value.trim()
    if (!cleaned || status === "loading") return

    setLastQuery(cleaned)
    setStatus("loading")
    setError(null)

    try {
      const data = await searchKnowledge({
        query: cleaned,
        top_k: DEFAULT_TOP_K,
      })
      setResult(data)
      setStatus("success")
    } catch (requestError) {
      setResult(null)
      setError(
        getApiErrorMessage(requestError, "Unable to search knowledge."),
      )
      setStatus("error")
    }
  }

  const canSubmit = query.trim().length > 0 && status !== "loading"

  return (
    <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-soft">
      <div className="mb-3">
        <p className="text-sm font-semibold text-foreground">
          Semantic knowledge search
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Search published, indexed knowledge chunks. This searches your
          knowledge base only — not conversations, tickets, or customers.
        </p>
      </div>

      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault()
          if (canSubmit) void runSearch(query)
        }}
      >
        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="kb-semantic-search">Search knowledge</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="kb-semantic-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ask about a policy, process, or article…"
              maxLength={QUERY_MAX_LENGTH}
              disabled={status === "loading"}
              aria-label="Semantic knowledge search"
              className="h-11 rounded-2xl bg-background pl-9"
            />
          </div>
        </div>
        <Button
          type="submit"
          className="h-11 rounded-2xl sm:min-w-28"
          disabled={!canSubmit}
        >
          {status === "loading" ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Searching…
            </>
          ) : (
            "Search"
          )}
        </Button>
      </form>

      <div className="mt-4">
        {status === "idle" ? (
          <p className="text-xs text-muted-foreground">
            Submit a search to retrieve matching published knowledge chunks.
          </p>
        ) : null}

        {status === "loading" ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Searching published knowledge…
          </div>
        ) : null}

        {status === "error" ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 dark:border-rose-500/30 dark:bg-rose-500/10">
            <p className="text-sm font-medium text-rose-800 dark:text-rose-200">
              Knowledge search failed
            </p>
            <p className="mt-1 text-xs text-rose-700/80 dark:text-rose-200/80">
              {error}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 rounded-xl"
              onClick={() => void runSearch(lastQuery || query)}
            >
              Retry
            </Button>
          </div>
        ) : null}

        {status === "success" && result ? (
          <KnowledgeSearchResults result={result} />
        ) : null}
      </div>
    </section>
  )
}

function KnowledgeSearchResults({
  result,
}: {
  result: KnowledgeSearchResponse
}) {
  if (result.count === 0 || result.results.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border px-3 py-8 text-center">
        <p className="text-sm font-semibold text-foreground">
          No matching knowledge found.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Try a different phrase, or publish and index documents first.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {result.count} {result.count === 1 ? "match" : "matches"} for "
        {result.query}"
      </p>
      <ul className="space-y-3">
        {result.results.map((hit) => (
          <KnowledgeSearchHitCard key={hit.id} hit={hit} />
        ))}
      </ul>
    </div>
  )
}

function KnowledgeSearchHitCard({ hit }: { hit: KnowledgeSearchHit }) {
  const metadata = hit.metadata ?? {}
  const title = knowledgeHitMetaString(metadata, "title")
  const source = knowledgeHitMetaString(metadata, "source")
  const sourceType = knowledgeHitMetaString(metadata, "source_type")
  const chunkLabel = formatKnowledgeChunkLabel(
    knowledgeHitMetaNumber(metadata, "chunk_index"),
    knowledgeHitMetaNumber(metadata, "chunk_count"),
  )
  const scoreLabel = formatKnowledgeScore(hit.score)

  return (
    <li className="rounded-xl border border-border/70 bg-background px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-foreground">
          {title ?? hit.id}
        </p>
        {scoreLabel ? (
          <Badge variant="secondary" className="rounded-full">
            {scoreLabel}
          </Badge>
        ) : null}
      </div>
      {sourceType || source || chunkLabel ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {sourceType ? (
            <span className="rounded-full bg-muted px-2 py-0.5 font-medium capitalize">
              {sourceType}
            </span>
          ) : null}
          {source ? <span className="truncate">{source}</span> : null}
          {chunkLabel ? (
            <>
              {sourceType || source ? <span>·</span> : null}
              <span>{chunkLabel}</span>
            </>
          ) : null}
        </div>
      ) : null}
      {hit.document.trim() ? (
        <p className="mt-2 text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground sm:text-sm">
          {hit.document}
        </p>
      ) : null}
    </li>
  )
}

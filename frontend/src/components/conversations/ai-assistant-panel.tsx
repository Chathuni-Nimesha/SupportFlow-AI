import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { BookOpen, Loader2, Sparkles } from "lucide-react"

import type { Conversation } from "@/data/conversations"
import type { ConversationAiSuggestion } from "@/types/conversations"
import { suggestConversationReply } from "@/services/conversation-ai"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { getApiErrorMessage } from "@/utils/api-error"
import { cn } from "@/lib/utils"

type AiPanelStatus = "idle" | "loading" | "success" | "error"

type AiAssistantPanelProps = {
  conversation: Conversation | null
  onUseSuggestion: (text: string) => void
  onEscalate?: () => void
  className?: string
}

function formatScore(score: number | null): string | null {
  if (score === null || Number.isNaN(score)) return null
  return `${Math.round(score * 100)}% match`
}

export function AiAssistantPanel({
  conversation,
  onUseSuggestion,
  onEscalate,
  className,
}: AiAssistantPanelProps) {
  const [status, setStatus] = useState<AiPanelStatus>("idle")
  const [suggestion, setSuggestion] = useState<ConversationAiSuggestion | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setStatus("idle")
    setSuggestion(null)
    setError(null)
  }, [conversation?.id])

  const handleGenerate = async () => {
    if (!conversation || status === "loading") return

    setStatus("loading")
    setError(null)

    try {
      const result = await suggestConversationReply(conversation.id, 5)
      setSuggestion(result)
      setStatus("success")
    } catch (err) {
      setSuggestion(null)
      setError(
        getApiErrorMessage(err, "Unable to generate an AI suggestion."),
      )
      setStatus("error")
    }
  }

  if (!conversation) {
    return (
      <aside
        className={cn(
          "flex h-full items-center justify-center border-l border-border/80 bg-card px-6",
          className,
        )}
      >
        <p className="text-center text-sm text-muted-foreground">
          AI suggestions appear when a conversation is selected.
        </p>
      </aside>
    )
  }

  const hasSources =
    suggestion !== null &&
    suggestion.sources.length > 0 &&
    suggestion.retrievedCount > 0

  return (
    <aside
      className={cn(
        "flex h-full min-w-0 flex-col border-l border-border/80 bg-card",
        className,
      )}
    >
      <div className="border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              AI Suggestions
            </p>
            <p className="text-xs text-muted-foreground">
              Grounded in your knowledge base
            </p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-border/70 bg-background p-4 shadow-soft"
          >
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="size-4 text-primary" aria-hidden />
              Suggested reply
            </div>

            {status === "idle" ? (
              <p className="text-sm leading-relaxed text-muted-foreground">
                Generate a grounded reply from the latest customer message and
                your published knowledge.
              </p>
            ) : null}

            {status === "loading" ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Generating suggestion…
              </div>
            ) : null}

            {status === "error" && error ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                {error}
              </p>
            ) : null}

            {status === "success" && suggestion ? (
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                {suggestion.suggestedReply}
              </p>
            ) : null}

            <div className="mt-3 flex flex-col gap-2">
              <Button
                type="button"
                variant={status === "success" ? "outline" : "default"}
                className="w-full rounded-2xl"
                disabled={status === "loading"}
                onClick={() => void handleGenerate()}
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Generating…
                  </>
                ) : status === "success" || status === "error" ? (
                  "Regenerate suggestion"
                ) : (
                  "Generate AI suggestion"
                )}
              </Button>

              {status === "success" && suggestion ? (
                <Button
                  type="button"
                  className="w-full rounded-2xl"
                  onClick={() => onUseSuggestion(suggestion.suggestedReply)}
                >
                  Use suggestion
                </Button>
              ) : null}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-2xl border border-border/70 bg-background p-4"
          >
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <BookOpen className="size-4 text-primary" aria-hidden />
              Knowledge sources
            </div>

            {status === "idle" || status === "loading" ? (
              <p className="text-sm text-muted-foreground">
                {status === "loading"
                  ? "Retrieving relevant knowledge…"
                  : "Sources appear after you generate a suggestion."}
              </p>
            ) : null}

            {status === "error" ? (
              <p className="text-sm text-muted-foreground">
                Knowledge sources unavailable until generation succeeds.
              </p>
            ) : null}

            {status === "success" && !hasSources ? (
              <p className="text-sm text-muted-foreground">
                No relevant knowledge found.
              </p>
            ) : null}

            {status === "success" && hasSources ? (
              <ul className="space-y-3">
                {suggestion!.sources.map((source, index) => {
                  const scoreLabel = formatScore(source.score)
                  return (
                    <li
                      key={source.chunkId ?? source.documentId ?? `source-${index}`}
                      className="rounded-xl border border-border/60 bg-card/40 px-3 py-2"
                    >
                      <p className="text-sm font-medium text-foreground">
                        {source.title?.trim() || "Untitled document"}
                      </p>
                      {source.source?.trim() ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {source.source}
                        </p>
                      ) : null}
                      {scoreLabel ? (
                        <p className="mt-1 text-[11px] font-medium text-primary">
                          {scoreLabel}
                        </p>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </motion.section>
        </div>
      </ScrollArea>

      <Separator />
      <div className="p-4">
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full rounded-2xl border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10"
          onClick={onEscalate}
        >
          Escalate to human
        </Button>
      </div>
    </aside>
  )
}

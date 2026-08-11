import { motion } from "framer-motion"
import {
  ArrowUpRight,
  BookOpen,
  Gauge,
  HeartPulse,
  Sparkles,
} from "lucide-react"

import type { Conversation } from "@/data/conversations"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const sentimentStyles = {
  Positive:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  Neutral: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
  Negative: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
} as const

type AiAssistantPanelProps = {
  conversation: Conversation | null
  onUseSuggestion: (text: string) => void
  onEscalate?: () => void
  className?: string
}

export function AiAssistantPanel({
  conversation,
  onUseSuggestion,
  onEscalate,
  className,
}: AiAssistantPanelProps) {
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

  const { ai } = conversation

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
            <p className="text-xs text-muted-foreground">Context-aware assist</p>
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
            <p className="text-sm leading-relaxed text-muted-foreground">
              {ai.suggestedReply}
            </p>
            <Button
              type="button"
              className="mt-3 w-full rounded-2xl"
              onClick={() => onUseSuggestion(ai.suggestedReply)}
            >
              Use suggestion
            </Button>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-2xl border border-border/70 bg-background p-4"
          >
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <BookOpen className="size-4 text-primary" aria-hidden />
              Knowledge article
            </div>
            <p className="text-sm font-medium text-foreground">
              {ai.knowledgeArticle.title}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {ai.knowledgeArticle.snippet}
            </p>
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80"
            >
              Open article
              <ArrowUpRight className="size-3.5" aria-hidden />
            </button>
          </motion.section>

          <section className="grid gap-3">
            <div className="rounded-2xl border border-border/70 bg-background p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                <HeartPulse className="size-4 text-primary" aria-hidden />
                Customer sentiment
              </div>
              <Badge
                variant="secondary"
                className={cn(
                  "rounded-full border-0",
                  sentimentStyles[ai.sentiment],
                )}
              >
                {ai.sentiment}
              </Badge>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Gauge className="size-4 text-primary" aria-hidden />
                  Confidence score
                </div>
                <span className="text-sm font-semibold text-primary">
                  {ai.confidence}%
                </span>
              </div>
              <Progress value={ai.confidence} className="h-2" />
              <p className="mt-2 text-xs text-muted-foreground">
                Based on retrieval quality and intent match.
              </p>
            </div>
          </section>
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

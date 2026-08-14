import { BookOpen, Loader2, Sparkles } from "lucide-react"

import { AiEmptyState } from "@/components/ai-assistant/ai-empty-state"
import { AiSourcesList } from "@/components/ai-assistant/ai-sources-list"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { AiAnswer } from "@/types/ai"

type AiResultStatus = "idle" | "loading" | "success" | "error"

type AiResultPanelProps = {
  status: AiResultStatus
  result: AiAnswer | null
  error: string | null
  onRetry: () => void
}

export function AiResultPanel({
  status,
  result,
  error,
  onRetry,
}: AiResultPanelProps) {
  if (status === "idle") {
    return <AiEmptyState />
  }

  if (status === "loading") {
    return (
      <Card className="rounded-2xl border-border/70 bg-card shadow-soft ring-border/60">
        <CardContent className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Retrieving published knowledge and generating an answer…
        </CardContent>
      </Card>
    )
  }

  if (status === "error") {
    return (
      <Card className="rounded-2xl border-border/70 bg-card shadow-soft ring-border/60">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-lg">Unable to answer</CardTitle>
          <CardDescription className="mt-1">
            The knowledge assistant could not complete this request.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
            {error ?? "Something went wrong. Please try again."}
          </p>
          <Button
            type="button"
            variant="outline"
            className="rounded-2xl"
            onClick={onRetry}
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!result) {
    return <AiEmptyState />
  }

  if (result.retrievedCount === 0) {
    return (
      <Card className="rounded-2xl border-border/70 bg-card shadow-soft ring-border/60">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-lg">Not enough knowledge</CardTitle>
          <CardDescription className="mt-1">
            No published knowledge was retrieved for this question.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <p className="text-sm leading-relaxed text-muted-foreground">
            There is not enough published knowledge to answer this question. No
            generated answer is shown.
          </p>
          <ResultMeta
            retrievedCount={result.retrievedCount}
            usedGeneration={result.usedGeneration}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
      <Card className="rounded-2xl border-border/70 bg-card shadow-soft ring-border/60">
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Answer</CardTitle>
              <CardDescription className="mt-1">
                Grounded in your published knowledge base.
              </CardDescription>
            </div>
            <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="size-4" aria-hidden />
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
            {result.answer}
          </p>
          <ResultMeta
            retrievedCount={result.retrievedCount}
            usedGeneration={result.usedGeneration}
          />
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70 bg-card shadow-soft ring-border/60">
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Sources</CardTitle>
              <CardDescription className="mt-1">
                Documents retrieved for this answer.
              </CardDescription>
            </div>
            <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <BookOpen className="size-4" aria-hidden />
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <AiSourcesList sources={result.sources} />
        </CardContent>
      </Card>
    </div>
  )
}

function ResultMeta({
  retrievedCount,
  usedGeneration,
}: {
  retrievedCount: number
  usedGeneration: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="secondary" className="rounded-full">
        Retrieved: {retrievedCount}
      </Badge>
      <Badge
        variant={usedGeneration ? "default" : "outline"}
        className="rounded-full"
      >
        {usedGeneration ? "Gemini generation used" : "No Gemini generation"}
      </Badge>
    </div>
  )
}

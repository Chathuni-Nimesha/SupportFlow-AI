import { Loader2, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type AiQuestionFormProps = {
  question: string
  isLoading: boolean
  onQuestionChange: (value: string) => void
  onSubmit: () => void
}

export function AiQuestionForm({
  question,
  isLoading,
  onQuestionChange,
  onSubmit,
}: AiQuestionFormProps) {
  const canSubmit = question.trim().length > 0 && !isLoading

  return (
    <Card className="rounded-2xl border-border/70 bg-card shadow-soft ring-border/60">
      <CardHeader className="border-b border-border/60 pb-4">
        <CardTitle className="text-lg">Ask a question</CardTitle>
        <CardDescription className="mt-1">
          Answers use only published knowledge from your workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-5">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (canSubmit) onSubmit()
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="ai-question">Question</Label>
            <Textarea
              id="ai-question"
              value={question}
              onChange={(event) => onQuestionChange(event.target.value)}
              placeholder="e.g. What is the refund policy?"
              maxLength={4000}
              disabled={isLoading}
              className="min-h-32 rounded-2xl bg-background px-3.5 py-3"
            />
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              className="rounded-2xl shadow-soft"
              disabled={!canSubmit}
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Asking…
                </>
              ) : (
                <>
                  <Sparkles className="size-4" aria-hidden />
                  Ask
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

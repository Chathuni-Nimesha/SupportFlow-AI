import { Sparkles } from "lucide-react"

export function AiEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center shadow-soft">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles className="size-5" aria-hidden />
      </span>
      <h3 className="mt-4 text-lg font-semibold text-foreground">
        Ready when you are
      </h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Ask a question about your published knowledge base.
      </p>
    </div>
  )
}

import { Loader2, SendHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type ReplyComposerProps = {
  draft: string
  onDraftChange: (value: string) => void
  onSend: (value: string) => Promise<void>
  disabled?: boolean
  sending?: boolean
  error?: string | null
}

export function ReplyComposer({
  draft,
  onDraftChange,
  onSend,
  disabled = false,
  sending = false,
  error = null,
}: ReplyComposerProps) {
  const handleSend = async () => {
    const value = draft.trim()
    if (!value || disabled || sending) return
    await onSend(value)
  }

  return (
    <div className="border-t border-border/70 bg-card p-4">
      {error ? (
        <p className="mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </p>
      ) : null}
      <div className="rounded-2xl border border-border/80 bg-background p-2 shadow-soft">
        <Textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Write a reply…"
          aria-label="Reply message"
          disabled={disabled || sending}
          className="min-h-24 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              void handleSend()
            }
          }}
        />
        <div className="flex items-center justify-between gap-3 px-1 pb-1">
          <p className="text-[11px] text-muted-foreground">
            Press Ctrl/⌘ + Enter to send
          </p>
          <Button
            type="button"
            className="rounded-2xl"
            disabled={!draft.trim() || sending || disabled}
            onClick={() => void handleSend()}
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <SendHorizontal className="size-4" />
            )}
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  )
}

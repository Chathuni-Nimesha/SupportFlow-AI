import { useState } from "react"
import { SendHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type ReplyComposerProps = {
  draft: string
  onDraftChange: (value: string) => void
  onSend: (value: string) => void
  disabled?: boolean
}

export function ReplyComposer({
  draft,
  onDraftChange,
  onSend,
  disabled = false,
}: ReplyComposerProps) {
  const [sending, setSending] = useState(false)

  const handleSend = async () => {
    const value = draft.trim()
    if (!value || disabled) return
    setSending(true)
    await new Promise((resolve) => setTimeout(resolve, 350))
    onSend(value)
    setSending(false)
  }

  return (
    <div className="border-t border-border/70 bg-card p-4">
      <div className="rounded-2xl border border-border/80 bg-background p-2 shadow-soft">
        <Textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Write a reply…"
          aria-label="Reply message"
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
            <SendHorizontal className="size-4" />
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}

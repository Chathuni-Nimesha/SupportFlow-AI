import { Loader2, Plus } from "lucide-react"

import { ConversationListItem } from "@/components/conversations/conversation-list-item"
import type { Conversation } from "@/data/conversations"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

type ConversationListProps = {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onCreate?: () => void
  isLoading?: boolean
  error?: string | null
  className?: string
}

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onCreate,
  isLoading = false,
  error = null,
  className,
}: ConversationListProps) {
  return (
    <section
      className={cn(
        "flex h-full min-w-0 flex-col border-r border-border/80 bg-background",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Conversations
          </h2>
          <p className="text-xs text-muted-foreground">
            {isLoading ? "Loading…" : `${conversations.length} in this view`}
          </p>
        </div>
        {onCreate ? (
          <Button
            type="button"
            size="sm"
            className="rounded-xl"
            onClick={onCreate}
          >
            <Plus className="size-3.5" />
            New
          </Button>
        ) : null}
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              <p className="text-sm">Loading conversations…</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-8 text-center dark:border-rose-500/30 dark:bg-rose-500/10">
              <p className="text-sm font-medium text-rose-800 dark:text-rose-200">
                Couldn’t load conversations
              </p>
              <p className="mt-1 text-xs text-rose-700/80 dark:text-rose-200/80">
                {error}
              </p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
              <p className="text-sm font-medium text-foreground">
                No conversations found
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Try another filter or search term, or create a new
                conversation.
              </p>
            </div>
          ) : (
            conversations.map((conversation) => (
              <ConversationListItem
                key={conversation.id}
                conversation={conversation}
                active={conversation.id === activeId}
                onSelect={onSelect}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </section>
  )
}

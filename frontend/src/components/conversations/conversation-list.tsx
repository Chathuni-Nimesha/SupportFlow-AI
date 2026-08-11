import { ConversationListItem } from "@/components/conversations/conversation-list-item"
import type { Conversation } from "@/data/conversations"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

type ConversationListProps = {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  className?: string
}

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  className,
}: ConversationListProps) {
  return (
    <section
      className={cn(
        "flex h-full min-w-0 flex-col border-r border-border/80 bg-background",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Conversations
          </h2>
          <p className="text-xs text-muted-foreground">
            {conversations.length} in this view
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {conversations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
              <p className="text-sm font-medium text-foreground">
                No conversations found
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Try another filter or search term.
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

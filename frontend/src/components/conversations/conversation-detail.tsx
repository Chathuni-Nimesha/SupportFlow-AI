import { ArrowLeft } from "lucide-react"

import { MessageBubble } from "@/components/conversations/message-bubble"
import { ReplyComposer } from "@/components/conversations/reply-composer"
import type { Conversation } from "@/data/conversations"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

type ConversationDetailProps = {
  conversation: Conversation | null
  draft: string
  onDraftChange: (value: string) => void
  onSend: (value: string) => void
  onBack?: () => void
  className?: string
}

export function ConversationDetail({
  conversation,
  draft,
  onDraftChange,
  onSend,
  onBack,
  className,
}: ConversationDetailProps) {
  if (!conversation) {
    return (
      <section
        className={cn(
          "flex h-full items-center justify-center bg-background",
          className,
        )}
      >
        <div className="max-w-sm px-6 text-center">
          <p className="text-base font-semibold text-foreground">
            Select a conversation
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose a thread from the list to read messages and reply.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className={cn("flex h-full min-w-0 flex-col bg-background", className)}>
      <header className="flex items-center gap-3 border-b border-border/70 px-4 py-3">
        {onBack ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-xl lg:hidden"
            onClick={onBack}
            aria-label="Back to conversations"
          >
            <ArrowLeft className="size-4" />
          </Button>
        ) : null}
        <Avatar className="rounded-2xl">
          <AvatarFallback className="rounded-2xl bg-primary/10 font-semibold text-primary">
            {conversation.initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-sm font-semibold text-foreground">
              {conversation.customerName}
            </h2>
            <Badge variant="secondary" className="rounded-full">
              {conversation.status}
            </Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {conversation.customerEmail} · {conversation.channel}
          </p>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="space-y-4 px-4 py-5">
          {conversation.messages.map((message, index) => (
            <MessageBubble key={message.id} message={message} index={index} />
          ))}
        </div>
      </ScrollArea>

      <ReplyComposer
        draft={draft}
        onDraftChange={onDraftChange}
        onSend={onSend}
      />
    </section>
  )
}

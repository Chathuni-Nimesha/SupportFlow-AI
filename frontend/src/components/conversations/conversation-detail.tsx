import { ArrowLeft, Loader2 } from "lucide-react"

import { MessageBubble } from "@/components/conversations/message-bubble"
import { ReplyComposer } from "@/components/conversations/reply-composer"
import type { Conversation, ConversationStatus } from "@/data/conversations"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

const STATUS_OPTIONS: ConversationStatus[] = [
  "Open",
  "Waiting",
  "Closed",
  "AI Resolved",
]

type ConversationDetailProps = {
  conversation: Conversation | null
  draft: string
  onDraftChange: (value: string) => void
  onSend: (value: string) => Promise<void>
  onStatusChange?: (status: ConversationStatus) => Promise<void> | void
  onBack?: () => void
  isMessagesLoading?: boolean
  messagesError?: string | null
  sendError?: string | null
  isSending?: boolean
  isUpdatingStatus?: boolean
  className?: string
}

export function ConversationDetail({
  conversation,
  draft,
  onDraftChange,
  onSend,
  onStatusChange,
  onBack,
  isMessagesLoading = false,
  messagesError = null,
  sendError = null,
  isSending = false,
  isUpdatingStatus = false,
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
        {onStatusChange ? (
          <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
            <span className="sr-only">Status</span>
            <select
              aria-label="Conversation status"
              value={conversation.status}
              disabled={isUpdatingStatus}
              onChange={(event) => {
                void onStatusChange(event.target.value as ConversationStatus)
              }}
              className="h-9 max-w-[8.5rem] rounded-xl border border-border/80 bg-card px-2 text-xs font-medium text-foreground shadow-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </header>

      <ScrollArea className="flex-1">
        <div className="space-y-4 px-4 py-5">
          {isMessagesLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              <p className="text-sm">Loading messages…</p>
            </div>
          ) : messagesError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-8 text-center dark:border-rose-500/30 dark:bg-rose-500/10">
              <p className="text-sm font-medium text-rose-800 dark:text-rose-200">
                Couldn’t load messages
              </p>
              <p className="mt-1 text-xs text-rose-700/80 dark:text-rose-200/80">
                {messagesError}
              </p>
            </div>
          ) : conversation.messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
              <p className="text-sm font-medium text-foreground">
                No messages yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Send a reply to start this thread.
              </p>
            </div>
          ) : (
            conversation.messages.map((message, index) => (
              <MessageBubble key={message.id} message={message} index={index} />
            ))
          )}
        </div>
      </ScrollArea>

      <ReplyComposer
        draft={draft}
        onDraftChange={onDraftChange}
        onSend={onSend}
        sending={isSending}
        error={sendError}
        disabled={isMessagesLoading || Boolean(messagesError)}
      />
    </section>
  )
}

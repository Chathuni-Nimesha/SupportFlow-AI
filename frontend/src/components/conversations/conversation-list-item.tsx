import { motion } from "framer-motion"

import type { Conversation, ConversationStatus } from "@/data/conversations"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const statusStyles: Record<ConversationStatus, string> = {
  Open: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  Waiting:
    "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  Closed:
    "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
  "AI Resolved":
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
}

type ConversationListItemProps = {
  conversation: Conversation
  active: boolean
  onSelect: (id: string) => void
}

export function ConversationListItem({
  conversation,
  active,
  onSelect,
}: ConversationListItemProps) {
  return (
    <motion.button
      type="button"
      layout
      onClick={() => onSelect(conversation.id)}
      className={cn(
        "w-full rounded-2xl border px-3 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active
          ? "border-primary/30 bg-primary/[0.06] shadow-soft"
          : "border-transparent hover:bg-muted/70",
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar size="default" className="rounded-2xl">
          <AvatarFallback className="rounded-2xl bg-primary/10 text-xs font-semibold text-primary">
            {conversation.initials}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">
              {conversation.customerName}
            </p>
            {conversation.unread > 0 ? (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                {conversation.unread}
              </span>
            ) : null}
            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
              {conversation.time}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {conversation.lastMessage}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Badge
              variant="secondary"
              className={cn(
                "rounded-full border-0 font-medium",
                statusStyles[conversation.status],
              )}
            >
              {conversation.status}
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              {conversation.channel}
            </span>
          </div>
        </div>
      </div>
    </motion.button>
  )
}

import { motion } from "framer-motion"
import { Bot, UserRound } from "lucide-react"

import type { ConversationMessage, MessageSender } from "@/data/conversations"
import { cn } from "@/lib/utils"

const senderMeta: Record<
  MessageSender,
  { label: string; align: "left" | "right"; bubble: string }
> = {
  customer: {
    label: "Customer",
    align: "left",
    bubble: "rounded-bl-md bg-muted text-foreground",
  },
  ai: {
    label: "AI",
    align: "left",
    bubble: "rounded-bl-md bg-primary text-primary-foreground shadow-soft",
  },
  agent: {
    label: "Agent",
    align: "right",
    bubble:
      "rounded-br-md border border-border/80 bg-card text-foreground shadow-soft",
  },
}

type MessageBubbleProps = {
  message: ConversationMessage
  index?: number
}

export function MessageBubble({ message, index = 0 }: MessageBubbleProps) {
  const meta = senderMeta[message.sender]
  const isAgent = message.sender === "agent"

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.04 }}
      className={cn(
        "flex gap-2",
        meta.align === "right" ? "justify-end" : "justify-start",
      )}
    >
      {!isAgent ? (
        <span
          className={cn(
            "mt-1 flex size-8 shrink-0 items-center justify-center rounded-xl",
            message.sender === "ai"
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          {message.sender === "ai" ? (
            <Bot className="size-3.5" aria-hidden />
          ) : (
            <UserRound className="size-3.5" aria-hidden />
          )}
        </span>
      ) : null}

      <div
        className={cn(
          "max-w-[min(100%,28rem)] space-y-1",
          isAgent && "items-end text-right",
        )}
      >
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {!isAgent ? <span>{meta.label}</span> : null}
          {isAgent ? <span className="ml-auto">{meta.label}</span> : null}
          <span>{message.timestamp}</span>
        </div>
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
            meta.bubble,
          )}
        >
          {message.content}
        </div>
      </div>
    </motion.div>
  )
}
